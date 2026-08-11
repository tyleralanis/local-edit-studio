import UIKit
import CoreGraphics
import CoreImage

enum ImageProcessor {
    static func renderMask(size: CGSize, strokes: [MaskStroke]) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: size, format: format)

        return renderer.image { ctx in
            UIColor.black.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            ctx.cgContext.setLineCap(.round)
            ctx.cgContext.setLineJoin(.round)

            for stroke in strokes {
                ctx.cgContext.setBlendMode(stroke.isEraser ? .copy : .normal)
                ctx.cgContext.setStrokeColor((stroke.isEraser ? UIColor.black : UIColor.white).cgColor)
                ctx.cgContext.setLineWidth(stroke.width)

                guard let first = stroke.points.first else { continue }
                ctx.cgContext.beginPath()
                ctx.cgContext.move(to: first)
                for p in stroke.points.dropFirst() {
                    ctx.cgContext.addLine(to: p)
                }
                ctx.cgContext.strokePath()
            }
        }
    }

    static func cropBox(from mask: UIImage, paddingFraction: CGFloat = 0.30) -> CGRect? {
        guard let cg = mask.cgImage,
              let data = cg.dataProvider?.data,
              let ptr = CFDataGetBytePtr(data) else { return nil }

        let width = cg.width
        let height = cg.height
        let bytesPerRow = cg.bytesPerRow
        let bytesPerPixel = max(1, cg.bitsPerPixel / 8)

        var minX = width
        var minY = height
        var maxX = -1
        var maxY = -1

        for y in 0..<height {
            for x in 0..<width {
                let offset = y * bytesPerRow + x * bytesPerPixel
                let r = ptr[offset]
                let g = bytesPerPixel > 1 ? ptr[offset + 1] : r
                let b = bytesPerPixel > 2 ? ptr[offset + 2] : r
                if Int(r) + Int(g) + Int(b) > 120 {
                    minX = min(minX, x)
                    minY = min(minY, y)
                    maxX = max(maxX, x)
                    maxY = max(maxY, y)
                }
            }
        }

        guard maxX >= minX, maxY >= minY else { return nil }

        let w = CGFloat(maxX - minX + 1)
        let h = CGFloat(maxY - minY + 1)
        let padX = w * paddingFraction
        let padY = h * paddingFraction

        return CGRect(
            x: max(0, CGFloat(minX) - padX),
            y: max(0, CGFloat(minY) - padY),
            width: min(CGFloat(width), CGFloat(maxX + 1) + padX) - max(0, CGFloat(minX) - padX),
            height: min(CGFloat(height), CGFloat(maxY + 1) + padY) - max(0, CGFloat(minY) - padY)
        ).integral
    }

    static func crop(_ image: UIImage, rect: CGRect) -> UIImage? {
        guard let cg = image.cgImage?.cropping(to: rect) else { return nil }
        return UIImage(cgImage: cg, scale: 1, orientation: .up)
    }

    static func composite(original: UIImage, generated: UIImage, mask: UIImage, rect: CGRect) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(size: original.size, format: format)

        return renderer.image { ctx in
            original.draw(in: CGRect(origin: .zero, size: original.size))

            guard let maskCrop = crop(mask, rect: rect) else { return }

            let targetRect = rect
            ctx.cgContext.saveGState()

            if let maskCG = maskCrop.cgImage {
                ctx.cgContext.clip(to: targetRect, mask: maskCG)
            }

            generated.draw(in: targetRect)
            ctx.cgContext.restoreGState()
        }
    }

    static func resized(_ image: UIImage, to target: CGSize) -> UIImage {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    static func squareForModel(_ image: UIImage, side: CGFloat = 512) -> UIImage {
        let canvas = CGSize(width: side, height: side)
        let scale = min(side / image.size.width, side / image.size.height)
        let size = CGSize(width: image.size.width * scale, height: image.size.height * scale)
        let origin = CGPoint(x: (side - size.width)/2, y: (side - size.height)/2)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: canvas, format: format).image { ctx in
            UIColor.black.setFill()
            ctx.fill(CGRect(origin: .zero, size: canvas))
            image.draw(in: CGRect(origin: origin, size: size))
        }
    }

    static func preservationScore(
        original: UIImage,
        candidate: UIImage,
        mask: UIImage?,
        rect: CGRect?
    ) -> Double {
        // Lower is better. Prefer natural tone continuity and minimal drift.
        let fullTone = averageColorDifference(original: original, candidate: candidate, mask: mask)
        let seam = seamDifference(original: original, candidate: candidate, mask: mask, rect: rect)
        return fullTone * 0.45 + seam * 0.55
    }

    private static func averageColorDifference(original: UIImage, candidate: UIImage, mask: UIImage?) -> Double {
        guard let o = pixelBuffer(from: original), let c = pixelBuffer(from: candidate) else { return 9999 }
        let count = min(o.count, c.count)
        if count == 0 { return 9999 }

        var total = 0.0
        var samples = 0.0

        var maskPixels: [UInt8]? = nil
        if let mask, let mp = grayscalePixels(from: mask) {
            maskPixels = mp
        }

        var i = 0
        var px = 0
        while i + 3 < count {
            let include: Bool
            if let maskPixels, px < maskPixels.count {
                include = maskPixels[px] > 15
            } else {
                include = true
            }

            if include {
                let dr = Double(Int(o[i]) - Int(c[i]))
                let dg = Double(Int(o[i+1]) - Int(c[i+1]))
                let db = Double(Int(o[i+2]) - Int(c[i+2]))
                total += abs(dr) + abs(dg) + abs(db)
                samples += 1
            }

            i += 4
            px += 1
        }
        return samples > 0 ? total / samples : 9999
    }

    private static func seamDifference(original: UIImage, candidate: UIImage, mask: UIImage?, rect: CGRect?) -> Double {
        guard let mask, let rect else { return 0 }
        let band = ringMask(from: mask, width: 18)
        guard let bandCrop = crop(band, rect: rect),
              let originalCrop = crop(original, rect: rect),
              let candidateCrop = crop(candidate, rect: rect) else {
            return 9999
        }
        return averageColorDifference(original: originalCrop, candidate: candidateCrop, mask: bandCrop)
    }

    static func ringMask(from mask: UIImage, width: CGFloat) -> UIImage {
        guard let ciMask = CIImage(image: mask) else { return mask }
        let filter = CIFilter.morphologyGradient()
        filter.inputImage = ciMask
        filter.radius = Float(width)
        let out = filter.outputImage ?? ciMask
        let context = CIContext()
        if let cg = context.createCGImage(out, from: out.extent) {
            return UIImage(cgImage: cg, scale: 1, orientation: .up)
        }
        return mask
    }

    private static func pixelBuffer(from image: UIImage) -> [UInt8]? {
        guard let cg = image.cgImage else { return nil }
        let width = cg.width
        let height = cg.height
        let bytesPerRow = width * 4
        var pixels = [UInt8](repeating: 0, count: Int(height * bytesPerRow))
        guard let ctx = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return nil }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
        return pixels
    }

    private static func grayscalePixels(from image: UIImage) -> [UInt8]? {
        guard let cg = image.cgImage else { return nil }
        let width = cg.width
        let height = cg.height
        let bytesPerRow = width
        var pixels = [UInt8](repeating: 0, count: Int(height * bytesPerRow))
        guard let ctx = CGContext(
            data: &pixels,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: bytesPerRow,
            space: CGColorSpaceCreateDeviceGray(),
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else { return nil }
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
        return pixels
    }

    static func outsideMaskDifference(original: UIImage, candidate: UIImage, mask: UIImage?) -> Double {
        guard let o = pixelBuffer(from: original), let c = pixelBuffer(from: candidate) else { return 9999 }
        let count = min(o.count, c.count)
        let maskPixels = mask.flatMap { grayscalePixels(from: $0) }

        var total = 0.0
        var samples = 0.0
        var i = 0
        var px = 0

        while i + 3 < count {
            let isOutside = maskPixels == nil || px >= maskPixels!.count || maskPixels![px] < 15
            if isOutside {
                let dr = Double(Int(o[i]) - Int(c[i]))
                let dg = Double(Int(o[i+1]) - Int(c[i+1]))
                let db = Double(Int(o[i+2]) - Int(c[i+2]))
                total += abs(dr) + abs(dg) + abs(db)
                samples += 1
            }
            i += 4
            px += 1
        }

        return samples > 0 ? total / samples : 0
    }

    static func globalToneDifference(original: UIImage, candidate: UIImage, excluding mask: UIImage?) -> Double {
        outsideMaskDifference(original: original, candidate: candidate, mask: mask)
    }

    static func boundaryDifference(original: UIImage, candidate: UIImage, mask: UIImage?) -> Double {
        guard let mask else { return 0 }
        let ring = ringMask(from: mask, width: 12)
        guard let o = pixelBuffer(from: original),
              let c = pixelBuffer(from: candidate),
              let m = grayscalePixels(from: ring) else { return 9999 }

        let count = min(o.count, c.count)
        var total = 0.0
        var samples = 0.0
        var i = 0
        var px = 0

        while i + 3 < count && px < m.count {
            if m[px] > 20 {
                total += abs(Double(Int(o[i]) - Int(c[i])))
                total += abs(Double(Int(o[i+1]) - Int(c[i+1])))
                total += abs(Double(Int(o[i+2]) - Int(c[i+2])))
                samples += 1
            }
            i += 4
            px += 1
        }

        return samples > 0 ? total / samples : 0
    }

}
