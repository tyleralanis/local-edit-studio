import Foundation
import UIKit
import UniformTypeIdentifiers
import ImageIO

enum ExportFormat: String, CaseIterable, Identifiable {
    case jpeg = "JPEG"
    case png = "PNG"
    case heif = "HEIF"

    var id: String { rawValue }
}

enum ExportService {
    static func export(
        image: UIImage,
        format: ExportFormat,
        quality: Double
    ) throws -> URL {
        let fm = FileManager.default
        let dir = fm.temporaryDirectory.appendingPathComponent("LocalEditStudioExports", isDirectory: true)
        try fm.createDirectory(at: dir, withIntermediateDirectories: true)

        let ext: String
        switch format {
        case .jpeg: ext = "jpg"
        case .png: ext = "png"
        case .heif: ext = "heic"
        }

        let url = dir.appendingPathComponent("LocalEditStudio-\(UUID().uuidString).\(ext)")

        switch format {
        case .jpeg:
            guard let data = image.jpegData(compressionQuality: quality) else {
                throw CocoaError(.fileWriteUnknown)
            }
            try data.write(to: url)

        case .png:
            guard let data = image.pngData() else {
                throw CocoaError(.fileWriteUnknown)
            }
            try data.write(to: url)

        case .heif:
            guard let cg = image.cgImage,
                  let dest = CGImageDestinationCreateWithURL(
                    url as CFURL,
                    UTType.heic.identifier as CFString,
                    1,
                    nil
                  ) else {
                throw CocoaError(.fileWriteUnknown)
            }

            let options = [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary
            CGImageDestinationAddImage(dest, cg, options)
            guard CGImageDestinationFinalize(dest) else {
                throw CocoaError(.fileWriteUnknown)
            }
        }

        return url
    }
}
