import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: HistoryStore

    var body: some View {
        NavigationStack {
            Group {
                if store.entries.isEmpty {
                    ContentUnavailableView(
                        "No edits yet",
                        systemImage: "clock.arrow.circlepath",
                        description: Text("Generated images are saved here locally.")
                    )
                } else {
                    List {
                        ForEach(store.entries) { entry in
                            HStack(spacing: 12) {
                                if let image = store.image(for: entry) {
                                    Image(uiImage: image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 74, height: 74)
                                        .clipShape(RoundedRectangle(cornerRadius: 10))
                                }
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(entry.prompt)
                                        .lineLimit(2)
                                    Text("Seed \(entry.seed) • \(entry.date.formatted(date: .abbreviated, time: .shortened))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .swipeActions {
                                Button(role: .destructive) {
                                    store.delete(entry)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("History")
        }
    }
}
