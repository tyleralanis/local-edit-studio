import SwiftUI

struct ExportOptionsView: View {
    let image: UIImage
    @Environment(\.dismiss) private var dismiss

    @State private var format: ExportFormat = .jpeg
    @State private var quality = 0.92
    @State private var exportURL: URL?
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            Form {
                Section("Format") {
                    Picker("Format", selection: $format) {
                        ForEach(ExportFormat.allCases) { f in
                            Text(f.rawValue).tag(f)
                        }
                    }
                    .pickerStyle(.segmented)
                }

                if format != .png {
                    Section("Quality") {
                        Slider(value: $quality, in: 0.50...1.0, step: 0.01)
                        LabeledContent("Compression quality", value: "\(Int(quality * 100))%")
                    }
                }

                Section("Resolution") {
                    LabeledContent(
                        "Export size",
                        value: "\(Int(image.size.width)) × \(Int(image.size.height))"
                    )
                    Text("Exports preserve the current result resolution.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Section {
                    Button("Prepare export") {
                        do {
                            exportURL = try ExportService.export(
                                image: image,
                                format: format,
                                quality: quality
                            )
                        } catch {
                            errorMessage = error.localizedDescription
                        }
                    }
                    .buttonStyle(.borderedProminent)

                    if let exportURL {
                        ShareLink(item: exportURL) {
                            Label("Share exported file", systemImage: "square.and.arrow.up")
                        }
                    }
                }
            }
            .navigationTitle("Export")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .alert("Export failed", isPresented: Binding(
                get: { errorMessage != nil },
                set: { if !$0 { errorMessage = nil } }
            )) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(errorMessage ?? "")
            }
        }
    }
}
