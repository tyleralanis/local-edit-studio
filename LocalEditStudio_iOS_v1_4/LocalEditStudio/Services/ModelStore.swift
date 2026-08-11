import Foundation
import UniformTypeIdentifiers

@MainActor
final class ModelStore: ObservableObject {
    @Published var installedModels: [InstalledModel] = []
    @Published var selectedModelID: UUID?
    @Published var lastError: String?

    private let fm = FileManager.default

    struct InstalledModel: Identifiable, Codable, Hashable {
        let id: UUID
        var name: String
        var folderName: String
        var installedAt: Date
    }

    init() {
        loadManifest()
    }

    var selectedModel: InstalledModel? {
        installedModels.first(where: { $0.id == selectedModelID }) ?? installedModels.first
    }

    var selectedModelURL: URL? {
        guard let model = selectedModel else { return nil }
        return modelsRoot.appendingPathComponent(model.folderName, isDirectory: true)
    }

    var modelsRoot: URL {
        let root = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Models", isDirectory: true)
        try? fm.createDirectory(at: root, withIntermediateDirectories: true)
        return root
    }

    func importModelFolder(from url: URL) {
        do {
            let accessing = url.startAccessingSecurityScopedResource()
            defer { if accessing { url.stopAccessingSecurityScopedResource() } }

            let name = url.lastPathComponent
            let safe = name.replacingOccurrences(of: " ", with: "_")
            let dest = modelsRoot.appendingPathComponent(safe, isDirectory: true)

            if fm.fileExists(atPath: dest.path) {
                try fm.removeItem(at: dest)
            }
            try fm.copyItem(at: url, to: dest)

            try validateModel(at: dest)

            let item = InstalledModel(
                id: UUID(),
                name: name,
                folderName: safe,
                installedAt: Date()
            )
            installedModels.append(item)
            selectedModelID = item.id
            saveManifest()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func remove(_ model: InstalledModel) {
        let url = modelsRoot.appendingPathComponent(model.folderName, isDirectory: true)
        try? fm.removeItem(at: url)
        installedModels.removeAll { $0.id == model.id }
        if selectedModelID == model.id {
            selectedModelID = installedModels.first?.id
        }
        saveManifest()
    }

    func select(_ model: InstalledModel) {
        selectedModelID = model.id
        saveManifest()
    }

    func validateModel(at url: URL) throws {
        let required = [
            "VAEDecoder.mlmodelc",
            "vocab.json",
            "merges.txt"
        ]
        for file in required {
            guard fm.fileExists(atPath: url.appendingPathComponent(file).path) else {
                throw NSError(
                    domain: "LocalEditStudio.Model",
                    code: 1,
                    userInfo: [NSLocalizedDescriptionKey:
                        "Model folder is missing \(file). Import the Resources folder produced for Apple's StableDiffusion Swift package."]
                )
            }
        }

        let hasText = fm.fileExists(atPath: url.appendingPathComponent("TextEncoder.mlmodelc").path)
                    || fm.fileExists(atPath: url.appendingPathComponent("TextEncoder2.mlmodelc").path)
        let hasUnet = fm.fileExists(atPath: url.appendingPathComponent("Unet.mlmodelc").path)
                    || (
                        fm.fileExists(atPath: url.appendingPathComponent("UnetChunk1.mlmodelc").path)
                        && fm.fileExists(atPath: url.appendingPathComponent("UnetChunk2.mlmodelc").path)
                    )

        guard hasText, hasUnet else {
            throw NSError(
                domain: "LocalEditStudio.Model",
                code: 2,
                userInfo: [NSLocalizedDescriptionKey:
                    "Model folder does not contain the expected text encoder and UNet resources."]
            )
        }
    }

    private var manifestURL: URL {
        modelsRoot.appendingPathComponent("manifest.json")
    }

    private func loadManifest() {
        guard let data = try? Data(contentsOf: manifestURL),
              let decoded = try? JSONDecoder().decode([InstalledModel].self, from: data) else {
            return
        }
        installedModels = decoded
        selectedModelID = decoded.first?.id
    }

    private func saveManifest() {
        guard let data = try? JSONEncoder().encode(installedModels) else { return }
        try? data.write(to: manifestURL, options: .atomic)
    }
}
