import SwiftUI
import UniformTypeIdentifiers

struct ModelManagerView: View {
    @EnvironmentObject private var store: ModelStore
    @State private var importing = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if store.installedModels.isEmpty {
                        VStack(spacing: 14) {
                            Image(systemName: "cpu")
                                .font(.system(size: 42))
                                .foregroundStyle(.tint)
                            Text("Install your on-device AI model")
                                .font(.headline)
                            Text("This is a one-time setup. After the model is installed, normal generation can run without your PC.")
                                .multilineTextAlignment(.center)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            Button {
                                importing = true
                            } label: {
                                Label("Import model folder", systemImage: "folder.badge.plus")
                            }
                            .buttonStyle(.borderedProminent)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 24)
                    } else {
                        ForEach(store.installedModels) { model in
                            HStack {
                                Image(systemName: store.selectedModel?.id == model.id ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(store.selectedModel?.id == model.id ? Color.green : Color.secondary)

                                VStack(alignment: .leading) {
                                    Text(model.name)
                                        .font(.headline)
                                    Text("Installed \(model.installedAt.formatted(date: .abbreviated, time: .shortened))")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                            }
                            .contentShape(Rectangle())
                            .onTapGesture { store.select(model) }
                            .swipeActions {
                                Button(role: .destructive) {
                                    store.remove(model)
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                } header: {
                    Text("On-device model")
                }

                if !store.installedModels.isEmpty {
                    Section {
                        Button {
                            importing = true
                        } label: {
                            Label("Import another model", systemImage: "folder.badge.plus")
                        }
                    }
                }

                Section("Help") {
                    NavigationLink {
                        ModelHelpView()
                    } label: {
                        Label("Model setup guide", systemImage: "questionmark.circle")
                    }

                    Text("For reliable phone-only editing, use a compressed Core ML model with a chunked UNet and a VAE encoder.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                if let err = store.lastError {
                    Section("Last error") {
                        Text(err)
                            .foregroundStyle(.red)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle("AI Model")
            .fileImporter(
                isPresented: $importing,
                allowedContentTypes: [.folder],
                allowsMultipleSelection: false
            ) { result in
                switch result {
                case .success(let urls):
                    if let first = urls.first {
                        store.importModelFolder(from: first)
                    }
                case .failure(let error):
                    store.lastError = error.localizedDescription
                }
            }
        }
    }
}
