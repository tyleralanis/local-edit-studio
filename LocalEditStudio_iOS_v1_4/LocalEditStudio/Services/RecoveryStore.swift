import Foundation
import UIKit

@MainActor
final class RecoveryStore: ObservableObject {
    static let shared = RecoveryStore()

    struct Snapshot: Codable {
        var prompt: String
        var negativePrompt: String
        var selectedAreaOnly: Bool
        var preserveOriginal: Double
        var quality: String
        var guidance: Double
        var seedText: String
        var timestamp: Date
        var hasSourceImage: Bool
    }

    private let fm = FileManager.default

    var root: URL {
        let u = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Recovery", isDirectory: true)
        try? fm.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    var snapshotURL: URL { root.appendingPathComponent("session.json") }
    var sourceURL: URL { root.appendingPathComponent("source.png") }

    func save(vm: EditorViewModel) {
        let snap = Snapshot(
            prompt: vm.prompt,
            negativePrompt: vm.negativePrompt,
            selectedAreaOnly: vm.selectedAreaOnly,
            preserveOriginal: vm.preserveOriginal,
            quality: vm.quality.rawValue,
            guidance: vm.guidance,
            seedText: vm.seedText,
            timestamp: Date(),
            hasSourceImage: vm.sourceImage != nil
        )

        if let data = try? JSONEncoder().encode(snap) {
            try? data.write(to: snapshotURL, options: .atomic)
        }

        if let image = vm.sourceImage, let data = image.pngData() {
            try? data.write(to: sourceURL, options: .atomic)
        }
    }

    func restore(into vm: EditorViewModel) -> Bool {
        guard let data = try? Data(contentsOf: snapshotURL),
              let snap = try? JSONDecoder().decode(Snapshot.self, from: data) else {
            return false
        }

        vm.prompt = snap.prompt
        vm.negativePrompt = snap.negativePrompt
        vm.selectedAreaOnly = snap.selectedAreaOnly
        vm.preserveOriginal = snap.preserveOriginal
        vm.guidance = snap.guidance
        vm.seedText = snap.seedText

        if let q = EditorViewModel.QualityPreset.allCases.first(where: { $0.rawValue == snap.quality }) {
            vm.quality = q
        }

        if snap.hasSourceImage,
           let image = UIImage(contentsOfFile: sourceURL.path) {
            vm.sourceImage = image
        }

        return true
    }

    func clear() {
        try? fm.removeItem(at: snapshotURL)
        try? fm.removeItem(at: sourceURL)
    }
}
