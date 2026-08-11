import Foundation
import UIKit
import Vision
import CoreImage
import CoreImage.CIFilterBuiltins

actor ForegroundExtractionService {
    static let shared = ForegroundExtractionService()

    enum ExtractionError: LocalizedError {
        case noImage
        case unsupported
        case noSubject

        var errorDescription: String? {
            switch self {
            case .noImage:
                return "Could not read the donor image."
            case .unsupported:
                return "Automatic subject extraction requires iOS 17 or newer."
            case .noSubject:
                return "No clear foreground person was detected."
            }
        }
    }

    func extractForeground(from image: UIImage) throws -> UIImage {
        guard #available(iOS 17.0, *) else {
            throw ExtractionError.unsupported
        }
        guard let cgImage = image.normalized().cgImage else {
            throw ExtractionError.noImage
        }

        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage)
        try handler.perform([request])

        guard let result = request.results?.first else {
            throw ExtractionError.noSubject
        }

        let instances = result.allInstances
        guard !instances.isEmpty else {
            throw ExtractionError.noSubject
        }

        let pixelBuffer = try result.generateScaledMaskForImage(
            forInstances: instances,
            from: handler
        )

        let ciImage = CIImage(cgImage: cgImage)
        let mask = CIImage(cvPixelBuffer: pixelBuffer)

        let clear = CIImage(color: .clear)
            .cropped(to: ciImage.extent)

        let blend = CIFilter.blendWithMask()
        blend.inputImage = ciImage
        blend.backgroundImage = clear
        blend.maskImage = mask

        guard let output = blend.outputImage else {
            throw ExtractionError.noSubject
        }

        let context = CIContext()
        guard let outCG = context.createCGImage(output, from: output.extent) else {
            throw ExtractionError.noSubject
        }

        return UIImage(cgImage: outCG, scale: 1, orientation: .up)
    }
}
