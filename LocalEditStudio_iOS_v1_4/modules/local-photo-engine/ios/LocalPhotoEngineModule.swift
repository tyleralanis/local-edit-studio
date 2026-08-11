import CoreImage
import CoreImage.CIFilterBuiltins
import ExpoModulesCore
import UIKit

public final class LocalPhotoEngineModule: Module {
  private let context = CIContext(options: [.cacheIntermediates: true])

  public func definition() -> ModuleDefinition {
    Name("LocalPhotoEngine")

    AsyncFunction("apply") {
      (uri: String, operation: String, amount: Double, strokesJSON: String, wholeImage: Bool) throws -> String in
      try self.applyEdit(
        uri: uri,
        operation: operation,
        amount: min(1, max(0, amount)),
        strokesJSON: strokesJSON,
        wholeImage: wholeImage
      )
    }
  }

  private func applyEdit(
    uri: String,
    operation: String,
    amount: Double,
    strokesJSON: String,
    wholeImage: Bool
  ) throws -> String {
    guard let sourceURL = resolveURL(uri),
          let sourceData = try? Data(contentsOf: sourceURL),
          let loadedImage = UIImage(data: sourceData) else {
      throw NSError(
        domain: "EditStudio.LocalPhotoEngine",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "The selected image could not be opened for local editing."]
      )
    }

    let sourceImage = normalizedImage(loadedImage)
    guard let input = CIImage(image: sourceImage) else {
      throw NSError(
        domain: "EditStudio.LocalPhotoEngine",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "The selected image could not be prepared for local editing."]
      )
    }

    let adjusted = try (operation == "remove" && !wholeImage
      ? cleanupImage(input, size: sourceImage.size, strokesJSON: strokesJSON, amount: amount)
      : filteredImage(input, operation: operation, amount: amount)
    ).cropped(to: input.extent)
    let output: CIImage

    if wholeImage {
      output = adjusted
    } else {
      let maskImage = renderMask(size: sourceImage.size, strokesJSON: strokesJSON)
      guard let rawMask = CIImage(image: maskImage) else {
        throw NSError(
          domain: "EditStudio.LocalPhotoEngine",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "The painted selection could not be prepared."]
        )
      }
      let feather = CIFilter.gaussianBlur()
      feather.inputImage = rawMask.clampedToExtent()
      feather.radius = Float(max(1.5, min(sourceImage.size.width, sourceImage.size.height) * 0.0025))
      let mask = (feather.outputImage ?? rawMask).cropped(to: input.extent)
      let blend = CIFilter.blendWithMask()
      blend.inputImage = adjusted
      blend.backgroundImage = input
      blend.maskImage = mask
      output = (blend.outputImage ?? input).cropped(to: input.extent)
    }

    guard let outputCG = context.createCGImage(output, from: input.extent),
          let pngData = UIImage(cgImage: outputCG).pngData() else {
      throw NSError(
        domain: "EditStudio.LocalPhotoEngine",
        code: 4,
        userInfo: [NSLocalizedDescriptionKey: "The local edit could not be rendered."]
      )
    }

    let directory = FileManager.default.temporaryDirectory.appendingPathComponent("EditStudioLocal", isDirectory: true)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    let outputURL = directory.appendingPathComponent("local-\(UUID().uuidString).png")
    try pngData.write(to: outputURL, options: .atomic)
    return outputURL.absoluteString
  }

  private func resolveURL(_ value: String) -> URL? {
    if let parsed = URL(string: value), parsed.isFileURL {
      return parsed
    }
    return URL(fileURLWithPath: value)
  }

  private func normalizedImage(_ image: UIImage) -> UIImage {
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true
    return UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: image.size))
    }
  }

  private func controls(
    _ input: CIImage,
    brightness: Float = 0,
    contrast: Float = 1,
    saturation: Float = 1
  ) -> CIImage {
    let filter = CIFilter.colorControls()
    filter.inputImage = input
    filter.brightness = brightness
    filter.contrast = contrast
    filter.saturation = saturation
    return filter.outputImage ?? input
  }

  private func tint(_ input: CIImage, red: CGFloat, green: CGFloat, blue: CGFloat) -> CIImage {
    let filter = CIFilter.colorMatrix()
    filter.inputImage = input
    filter.biasVector = CIVector(x: red, y: green, z: blue, w: 0)
    return filter.outputImage ?? input
  }

  private func filteredImage(_ input: CIImage, operation: String, amount: Double) throws -> CIImage {
    let strength = Float(amount)
    if let targetColor = recolorTarget(operation) {
      let red = targetColor.red
      let green = targetColor.green
      let blue = targetColor.blue
      let recolor = CIFilter.falseColor()
      recolor.inputImage = input
      recolor.color0 = CIColor(red: red * 0.28, green: green * 0.28, blue: blue * 0.28)
      recolor.color1 = CIColor(
        red: red + (1 - red) * 0.62,
        green: green + (1 - green) * 0.62,
        blue: blue + (1 - blue) * 0.62
      )
      return recolor.outputImage ?? input
    }

    switch operation {
    case "brighten":
      return controls(input, brightness: 0.34 * strength)
    case "darken":
      return controls(input, brightness: -0.30 * strength)
    case "contrast":
      return controls(input, contrast: 1 + 0.70 * strength)
    case "vibrant":
      return controls(input, brightness: 0.02 * strength, contrast: 1 + 0.18 * strength, saturation: 1 + 0.85 * strength)
    case "blackAndWhite":
      let filter = CIFilter.photoEffectNoir()
      filter.inputImage = input
      return filter.outputImage ?? input
    case "warm":
      return tint(input, red: CGFloat(0.10 * amount), green: CGFloat(0.025 * amount), blue: CGFloat(-0.075 * amount))
    case "cool":
      return tint(input, red: CGFloat(-0.065 * amount), green: CGFloat(0.015 * amount), blue: CGFloat(0.10 * amount))
    case "blur":
      let filter = CIFilter.gaussianBlur()
      filter.inputImage = input.clampedToExtent()
      filter.radius = 1 + 14 * strength
      return (filter.outputImage ?? input).cropped(to: input.extent)
    case "sharpen":
      let filter = CIFilter.sharpenLuminance()
      filter.inputImage = input
      filter.sharpness = 0.15 + 1.35 * strength
      return filter.outputImage ?? input
    case "smooth":
      let filter = CIFilter.noiseReduction()
      filter.inputImage = input
      filter.noiseLevel = 0.018 + 0.045 * strength
      filter.sharpness = 0.22
      return controls(filter.outputImage ?? input, brightness: 0.015 * strength, saturation: 1.03)
    case "cinematic":
      let graded = controls(input, brightness: -0.025 * strength, contrast: 1 + 0.24 * strength, saturation: 1 - 0.15 * strength)
      let vignette = CIFilter.vignette()
      vignette.inputImage = tint(graded, red: CGFloat(0.035 * amount), green: 0, blue: CGFloat(-0.025 * amount))
      vignette.intensity = 0.25 + 0.85 * strength
      vignette.radius = 1.4
      return vignette.outputImage ?? graded
    case "remove":
      let clamped = input.clampedToExtent()
      let soften = CIFilter.gaussianBlur()
      soften.inputImage = clamped
      soften.radius = 12 + 30 * strength
      let softened = (soften.outputImage ?? input).cropped(to: input.extent)
      return controls(softened, contrast: 1.04, saturation: 0.96)
    default:
      let enhanced = controls(input, brightness: 0.025 * strength, contrast: 1 + 0.12 * strength, saturation: 1 + 0.16 * strength)
      let sharpen = CIFilter.sharpenLuminance()
      sharpen.inputImage = enhanced
      sharpen.sharpness = 0.28 + 0.35 * strength
      return sharpen.outputImage ?? enhanced
    }
  }

  private func recolorTarget(_ operation: String) -> CIColor? {
    let prefix = "recolor:#"
    guard operation.hasPrefix(prefix) else { return nil }
    let hex = String(operation.dropFirst(prefix.count))
    guard hex.count == 6, let value = UInt64(hex, radix: 16) else { return nil }
    return CIColor(
      red: CGFloat((value >> 16) & 0xff) / 255,
      green: CGFloat((value >> 8) & 0xff) / 255,
      blue: CGFloat(value & 0xff) / 255
    )
  }

  private func cleanupImage(
    _ input: CIImage,
    size: CGSize,
    strokesJSON: String,
    amount: Double
  ) -> CIImage {
    guard let bounds = selectionBounds(size: size, strokesJSON: strokesJSON) else { return input }
    let gap = max(8, min(size.width, size.height) * 0.015)
    let boxWidth = max(gap, bounds.width)
    let boxHeight = max(gap, bounds.height)
    let candidates: [(available: CGFloat, x: CGFloat, y: CGFloat)] = [
      (bounds.minY, 0, min(bounds.minY, boxHeight + gap)),
      (size.height - bounds.maxY, 0, -min(size.height - bounds.maxY, boxHeight + gap)),
      (bounds.minX, min(bounds.minX, boxWidth + gap), 0),
      (size.width - bounds.maxX, -min(size.width - bounds.maxX, boxWidth + gap), 0),
    ]
    guard let offset = candidates.max(by: { $0.available < $1.available }) else { return input }

    // UIKit selection coordinates grow downward; Core Image coordinates grow upward.
    let shifted = input.transformed(by: CGAffineTransform(translationX: offset.x, y: -offset.y))
    let soften = CIFilter.gaussianBlur()
    soften.inputImage = shifted.clampedToExtent()
    soften.radius = Float(0.5 + amount * 1.2)
    return (soften.outputImage ?? shifted).cropped(to: input.extent)
  }

  private func selectionBounds(size: CGSize, strokesJSON: String) -> CGRect? {
    let data = strokesJSON.data(using: .utf8) ?? Data()
    let strokes = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] ?? []
    var bounds: CGRect?

    for stroke in strokes where !(stroke["erase"] as? Bool ?? false) {
      guard let rawPoints = stroke["points"] as? [[String: Any]], !rawPoints.isEmpty else { continue }
      let normalizedWidth = (stroke["width"] as? NSNumber)?.doubleValue ?? 0.075
      let radius = CGFloat(normalizedWidth) * min(size.width, size.height) * 0.6
      for point in rawPoints {
        let x = CGFloat((point["x"] as? NSNumber)?.doubleValue ?? 0) * size.width
        let y = CGFloat((point["y"] as? NSNumber)?.doubleValue ?? 0) * size.height
        let pointBounds = CGRect(x: x - radius, y: y - radius, width: radius * 2, height: radius * 2)
        bounds = bounds?.union(pointBounds) ?? pointBounds
      }
    }

    return bounds?.intersection(CGRect(origin: .zero, size: size))
  }

  private func renderMask(size: CGSize, strokesJSON: String) -> UIImage {
    let data = strokesJSON.data(using: .utf8) ?? Data()
    let strokes = (try? JSONSerialization.jsonObject(with: data)) as? [[String: Any]] ?? []
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    format.opaque = true

    return UIGraphicsImageRenderer(size: size, format: format).image { renderer in
      let context = renderer.cgContext
      context.setFillColor(UIColor.black.cgColor)
      context.fill(CGRect(origin: .zero, size: size))
      context.setLineCap(.round)
      context.setLineJoin(.round)

      for stroke in strokes {
        guard let rawPoints = stroke["points"] as? [[String: Any]], !rawPoints.isEmpty else { continue }
        let erase = stroke["erase"] as? Bool ?? false
        let normalizedWidth = (stroke["width"] as? NSNumber)?.doubleValue ?? 0.075
        let points = rawPoints.map { point in
          CGPoint(
            x: CGFloat((point["x"] as? NSNumber)?.doubleValue ?? 0) * size.width,
            y: CGFloat((point["y"] as? NSNumber)?.doubleValue ?? 0) * size.height
          )
        }
        context.setStrokeColor((erase ? UIColor.black : UIColor.white).cgColor)
        context.setFillColor((erase ? UIColor.black : UIColor.white).cgColor)
        let lineWidth = CGFloat(normalizedWidth) * min(size.width, size.height)
        context.setLineWidth(lineWidth)

        if points.count == 1 {
          let radius = lineWidth / 2
          context.fillEllipse(in: CGRect(x: points[0].x - radius, y: points[0].y - radius, width: radius * 2, height: radius * 2))
        } else {
          context.beginPath()
          context.move(to: points[0])
          for point in points.dropFirst() { context.addLine(to: point) }
          context.strokePath()
        }
      }
    }
  }
}
