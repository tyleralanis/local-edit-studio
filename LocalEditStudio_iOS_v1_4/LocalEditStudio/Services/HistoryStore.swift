import Foundation
import UIKit

@MainActor
final class HistoryStore: ObservableObject {
    struct Entry: Identifiable, Codable {
        var id: UUID
        var fileName: String
        var prompt: String
        var seed: UInt32
        var date: Date
    }

    @Published var entries: [Entry] = []
    private let fm = FileManager.default

    init() {
        load()
    }

    private var root: URL {
        let u = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("History", isDirectory: true)
        try? fm.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private var manifest: URL {
        root.appendingPathComponent("history.json")
    }

    func add(image: UIImage, prompt: String, seed: UInt32) {
        let id = UUID()
        let name = "\(id.uuidString).png"
        if let data = image.pngData() {
            try? data.write(to: root.appendingPathComponent(name), options: .atomic)
        }
        entries.insert(
            Entry(id: id, fileName: name, prompt: prompt, seed: seed, date: Date()),
            at: 0
        )
        save()
    }

    func image(for entry: Entry) -> UIImage? {
        UIImage(contentsOfFile: root.appendingPathComponent(entry.fileName).path)
    }

    func delete(_ entry: Entry) {
        try? fm.removeItem(at: root.appendingPathComponent(entry.fileName))
        entries.removeAll { $0.id == entry.id }
        save()
    }

    private func load() {
        guard let data = try? Data(contentsOf: manifest),
              let arr = try? JSONDecoder().decode([Entry].self, from: data) else { return }
        entries = arr
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(entries) else { return }
        try? data.write(to: manifest, options: .atomic)
    }
}
