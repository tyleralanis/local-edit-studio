import SwiftUI
import PhotosUI

struct EditorView: View {
    @EnvironmentObject private var modelStore: ModelStore
    @EnvironmentObject private var history: HistoryStore
    @StateObject private var vm = EditorViewModel()
    @State private var qualityReport: QualityReport?
    @State private var showExport = false
    @State private var showRecoveryNotice = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    hero
                    modelStatus

                    if let source = vm.sourceImage {
                        StudioCard {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Text("1. Select what to edit")
                                        .font(.headline)
                                    Spacer()
                                    if vm.selectedAreaOnly {
                                        StatusPill(
                                            text: vm.strokes.isEmpty ? "Paint a selection" : "Selection ready",
                                            systemImage: vm.strokes.isEmpty ? "paintbrush" : "checkmark.circle.fill",
                                            tint: vm.strokes.isEmpty ? .orange : .green
                                        )
                                    }
                                }

                                MaskCanvas(
                                    image: source,
                                    strokes: $vm.strokes,
                                    brushSize: $vm.brushSize,
                                    isErasing: $vm.isErasing
                                )
                                .frame(height: 430)

                                selectionControls
                            }
                        }
                    } else {
                        emptyPhoto
                    }

                    StudioCard {
                        promptControls
                    }

                    StudioCard {
                        generationControls
                    }

                    if vm.isGenerating {
                        generationProgress
                    }

                    if !vm.resultImages.isEmpty {
                        resultsSection
                    }
                }
                .padding()
            }
            .background(StudioTheme.background.ignoresSafeArea())
            .navigationTitle("Local Edit Studio")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    PhotosPicker(selection: $vm.selectedPhotoItem, matching: .images) {
                        Label("Photo", systemImage: "photo.badge.plus")
                    }
                }
            }
            .task(id: vm.selectedPhotoItem) {
                await vm.loadSelectedPhoto()
            }
            .alert(
                "Something went wrong",
                isPresented: Binding(
                    get: { vm.errorMessage != nil },
                    set: { if !$0 { vm.errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) { vm.errorMessage = nil }
            } message: {
                Text(vm.errorMessage ?? "")
            }
            .sheet(isPresented: $showExport) {
                if let result = vm.selectedResult {
                    ExportOptionsView(image: result)
                }
            }
            .alert("Recovered previous session", isPresented: $showRecoveryNotice) {
                Button("Continue") {}
                Button("Discard", role: .destructive) {
                    RecoveryStore.shared.clear()
                }
            } message: {
                Text("Local Edit Studio restored your last autosaved source image and editing settings.")
            }
            .onAppear {
                if RecoveryStore.shared.restore(into: vm) {
                    showRecoveryNotice = true
                }
            }
            .onChange(of: scenePhase) { _, phase in
                if phase != .active {
                    RecoveryStore.shared.save(vm: vm)
                }
            }
            .onChange(of: vm.prompt) { _, _ in
                RecoveryStore.shared.save(vm: vm)
            }
        }
    }

    private var hero: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text("Professional local photo editing")
                .font(.title2.bold())
            Text("Localized editing with preservation locks: change what you select, keep everything else as close to the original as possible.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var modelStatus: some View {
        Group {
            if let model = modelStore.selectedModel {
                HStack {
                    StatusPill(text: "On-device model ready", systemImage: "iphone.gen3", tint: .green)
                    Text(model.name)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Spacer()
                }
            } else {
                NavigationLink {
                    ModelManagerView()
                } label: {
                    StudioCard {
                        HStack {
                            Image(systemName: "shippingbox.fill")
                                .foregroundStyle(.orange)
                            VStack(alignment: .leading) {
                                Text("Install an AI model")
                                    .font(.headline)
                                Text("Required once before offline generation.")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                        }
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var emptyPhoto: some View {
        PhotosPicker(selection: $vm.selectedPhotoItem, matching: .images) {
            StudioCard {
                VStack(spacing: 14) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 46))
                        .foregroundStyle(.tint)
                    Text("Choose your original photo")
                        .font(.headline)
                    Text("No pre-editing or external mask is required.")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                    Text("Choose Photo")
                        .font(.headline)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .foregroundStyle(.white)
                        .background(Color.accentColor, in: Capsule())
                }
                .frame(maxWidth: .infinity)
                .frame(height: 285)
            }
        }
        .buttonStyle(.plain)
    }

    private var selectionControls: some View {
        VStack(spacing: 10) {
            Picker("Mode", selection: $vm.selectedAreaOnly) {
                Text("Selected area").tag(true)
                Text("Whole image").tag(false)
            }
            .pickerStyle(.segmented)

            if vm.selectedAreaOnly {
                HStack {
                    Button {
                        vm.isErasing = false
                    } label: {
                        Label("Brush", systemImage: "paintbrush.fill")
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(vm.isErasing ? .gray : .accentColor)

                    Button {
                        vm.isErasing = true
                    } label: {
                        Label("Erase", systemImage: "eraser.fill")
                    }
                    .buttonStyle(.bordered)

                    Spacer()

                    Button("Undo") { vm.undoStroke() }
                        .disabled(vm.strokes.isEmpty)
                    Button("Clear") { vm.clearMask() }
                        .disabled(vm.strokes.isEmpty)
                }

                HStack {
                    Image(systemName: "circle.fill")
                        .font(.caption)
                    Slider(value: $vm.brushSize, in: 20...180)
                    Image(systemName: "circle.fill")
                        .font(.title3)
                }

                Menu {
                    Button("Select person") {
                        vm.applySmartMask(mode: .person)
                    }
                    Button("Select foreground object") {
                        vm.applySmartMask(mode: .foreground)
                    }
                    Button("Select background") {
                        vm.applySmartMask(mode: .background)
                    }
                } label: {
                    Label("Smart Select", systemImage: "wand.and.rays")
                }

                if vm.automaticMask != nil {
                    StatusPill(
                        text: "Automatic mask active",
                        systemImage: "checkmark.circle.fill",
                        tint: .green
                    )
                }
            }
        }
    }

    private var promptControls: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("2. Describe the edit")
                .font(.headline)

            Picker("Edit style", selection: $vm.editIntent) {
                ForEach(EditorViewModel.EditIntent.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.segmented)
            .onChange(of: vm.editIntent) { _, newValue in
                vm.applyIntentPreset(newValue)
            }

            Text(vm.editIntent.helperText)
                .font(.caption)
                .foregroundStyle(.secondary)

            TextField(
                "Example: replace the jacket with a fitted dark green canvas jacket",
                text: $vm.prompt,
                axis: .vertical
            )
            .lineLimit(3...6)
            .textFieldStyle(.roundedBorder)

            Toggle("Photorealism assist", isOn: $vm.photorealismAssist)
            Toggle("Preserve lighting & perspective", isOn: $vm.preserveLightingAssist)

            DisclosureGroup("Preservation locks") {
                VStack(spacing: 8) {
                    Toggle("Lock visible identity", isOn: $vm.lockIdentity)
                    Toggle("Lock proportions & geometry", isOn: $vm.lockGeometry)
                    Toggle("Lock scene/background", isOn: $vm.lockScene)
                }
                .padding(.top, 8)
            }

            DisclosureGroup("Exact prompt sent to the model") {
                Text(vm.effectivePrompt.isEmpty ? "Enter an edit above." : vm.effectivePrompt)
                    .font(.footnote.monospaced())
                    .textSelection(.enabled)
                    .padding(.top, 8)
            }

            DisclosureGroup("Negative prompt") {
                TextField("Optional things to avoid", text: $vm.negativePrompt, axis: .vertical)
                    .textFieldStyle(.roundedBorder)
                    .padding(.top, 8)
            }
        }
    }

    private var generationControls: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("3. Generate")
                .font(.headline)

            Picker("Quality", selection: $vm.quality) {
                ForEach(EditorViewModel.QualityPreset.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.segmented)

            Text(vm.quality.help)
                .font(.caption)
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 5) {
                HStack {
                    Text("Preserve original")
                    Spacer()
                    Text(vm.preserveOriginal > 0.72 ? "High" : vm.preserveOriginal > 0.42 ? "Medium" : "Low")
                        .foregroundStyle(.secondary)
                }
                Slider(value: $vm.preserveOriginal, in: 0.05...0.95)
            }

            Stepper("Variations: \(vm.variationCount)", value: $vm.variationCount, in: 1...4)

            DisclosureGroup("Advanced") {
                VStack(spacing: 12) {
                    HStack {
                        Text("Guidance")
                        Slider(value: $vm.guidance, in: 1...12, step: 0.5)
                        Text(vm.guidance.formatted(.number.precision(.fractionLength(1))))
                            .monospacedDigit()
                    }
                    HStack {
                        TextField("Seed", text: $vm.seedText)
                            .keyboardType(.numberPad)
                            .textFieldStyle(.roundedBorder)
                        Button("Random") { vm.randomizeSeed() }
                    }
                }
                .padding(.top, 8)
            }

            if vm.isGenerating {
                Button(role: .destructive) {
                    vm.cancel()
                } label: {
                    Label("Cancel generation", systemImage: "xmark.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            } else {
                Button {
                    if let url = modelStore.selectedModelURL {
                        vm.generate(modelURL: url, history: history)
                    } else {
                        vm.errorMessage = "Install and select a model in the Models tab first."
                    }
                } label: {
                    Label("Generate edit", systemImage: "sparkles")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 7)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(vm.sourceImage == nil || vm.prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    private var generationProgress: some View {
        StudioCard {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    ProgressView()
                    Text(vm.status)
                        .font(.subheadline.weight(.medium))
                }
                ProgressView(value: vm.progress)
                Text("\(Int(vm.progress * 100))%")
                    .font(.caption.monospacedDigit())
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var resultsSection: some View {
        StudioCard {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Results")
                        .font(.headline)
                    Spacer()
                    Text("\(vm.resultImages.count) generated")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                if vm.resultImages.count > 1 {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach(Array(vm.resultImages.enumerated()), id: \.offset) { index, image in
                                Button {
                                    vm.selectedResultIndex = index
                                } label: {
                                    Image(uiImage: image)
                                        .resizable()
                                        .scaledToFill()
                                        .frame(width: 88, height: 88)
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 12)
                                                .stroke(
                                                    vm.selectedResultIndex == index ? Color.accentColor : .clear,
                                                    lineWidth: 3
                                                )
                                        )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }

                if let result = vm.selectedResult {
                    Button {
                        Task {
                            qualityReport = await QualityInspector.shared.inspect(
                                original: vm.sourceImage ?? result,
                                candidate: result,
                                mask: vm.automaticMask
                            )
                        }
                    } label: {
                        Label("Run quality inspection", systemImage: "checkmark.seal")
                    }
                    .buttonStyle(.bordered)

                    if let report = qualityReport {
                        VStack(alignment: .leading, spacing: 8) {
                            HStack {
                                Text("Quality: \(report.grade)")
                                    .font(.headline)
                                Spacer()
                                Text("\(Int(report.score * 100))%")
                                    .monospacedDigit()
                            }

                            ForEach(report.warnings, id: \.self) { warning in
                                Label(warning, systemImage: "exclamationmark.triangle")
                                    .font(.caption)
                                    .foregroundStyle(.orange)
                            }

                            ForEach(report.passedChecks, id: \.self) { item in
                                Label(item, systemImage: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                            }
                        }
                        .padding(10)
                        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 12))
                    }

                    ResultCard(image: result, prompt: vm.effectivePrompt)

                    Button {
                        showExport = true
                    } label: {
                        Label("Export options", systemImage: "slider.horizontal.3")
                    }
                    .buttonStyle(.bordered)

                    Button {
                        vm.useSelectedResultAsSource()
                    } label: {
                        Label("Continue editing this result", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }
}

private struct ResultCard: View {
    let image: UIImage
    let prompt: String
    @State private var saveMessage: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .clipShape(RoundedRectangle(cornerRadius: 14))

            HStack {
                ShareLink(
                    item: ImageTransferable(image: image),
                    preview: SharePreview("Edited image")
                ) {
                    Label("Share", systemImage: "square.and.arrow.up")
                }

                Button {
                    UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
                    saveMessage = "Saved to Photos"
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                }
            }

            if let saveMessage {
                Text(saveMessage)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
