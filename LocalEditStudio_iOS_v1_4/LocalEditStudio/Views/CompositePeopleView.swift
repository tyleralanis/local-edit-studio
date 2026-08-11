import SwiftUI
import PhotosUI

struct CompositePeopleView: View {
    @StateObject private var vm = CompositeViewModel()
    @State private var dragStart = CGPoint(x: 0.5, y: 0.55)
    @State private var scaleStart: CGFloat = 1
    @State private var rotationStart: Double = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 16) {
                    intro
                    photoPickers

                    if let base = vm.baseImage {
                        StudioCard {
                            VStack(alignment: .leading, spacing: 12) {
                                HStack {
                                    Text("Place the donor person")
                                        .font(.headline)
                                    Spacer()
                                    if vm.extractedSubject != nil {
                                        StatusPill(
                                            text: "Subject isolated",
                                            systemImage: "person.crop.rectangle",
                                            tint: .green
                                        )
                                    }
                                }

                                placementCanvas(base: base)

                                if vm.extractedSubject != nil {
                                    controls
                                }
                            }
                        }
                    }

                    if let result = vm.resultImage {
                        StudioCard {
                            VStack(alignment: .leading, spacing: 10) {
                                Text("Composite result")
                                    .font(.headline)
                                Image(uiImage: result)
                                    .resizable()
                                    .scaledToFit()
                                    .clipShape(RoundedRectangle(cornerRadius: 14))

                                HStack {
                                    ShareLink(
                                        item: ImageTransferable(image: result),
                                        preview: SharePreview("Composite image")
                                    ) {
                                        Label("Share", systemImage: "square.and.arrow.up")
                                    }

                                    Button {
                                        UIImageWriteToSavedPhotosAlbum(result, nil, nil, nil)
                                    } label: {
                                        Label("Save", systemImage: "square.and.arrow.down")
                                    }
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .background(StudioTheme.background.ignoresSafeArea())
            .navigationTitle("Combine People")
            .task(id: vm.basePhotoItem) { await vm.loadBase() }
            .task(id: vm.donorPhotoItem) { await vm.loadDonor() }
            .alert(
                "Couldn’t complete that",
                isPresented: Binding(
                    get: { vm.errorMessage != nil },
                    set: { if !$0 { vm.errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) { vm.errorMessage = nil }
            } message: {
                Text(vm.errorMessage ?? "")
            }
        }
    }

    private var intro: some View {
        StudioCard {
            VStack(alignment: .leading, spacing: 8) {
                Label("Create one image from separate portraits", systemImage: "person.2.crop.square.stack")
                    .font(.title3.bold())

                Text("""
Choose the photo you want to keep as the base, then choose a second photo containing the person you want to add. Local Edit Studio automatically isolates the donor subject so you can position them naturally in the base photograph.
""")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            }
        }
    }

    private var photoPickers: some View {
        StudioCard {
            VStack(spacing: 12) {
                PhotosPicker(selection: $vm.basePhotoItem, matching: .images) {
                    HStack {
                        Image(systemName: vm.baseImage == nil ? "photo.badge.plus" : "checkmark.circle.fill")
                            .foregroundStyle(vm.baseImage == nil ? .tint : .green)
                        VStack(alignment: .leading) {
                            Text("1. Choose base photo")
                                .font(.headline)
                            Text("The scene and person you want to keep.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)

                Divider()

                PhotosPicker(selection: $vm.donorPhotoItem, matching: .images) {
                    HStack {
                        Image(systemName: vm.extractedSubject == nil ? "person.crop.rectangle.badge.plus" : "checkmark.circle.fill")
                            .foregroundStyle(vm.extractedSubject == nil ? .tint : .green)
                        VStack(alignment: .leading) {
                            Text("2. Choose donor photo")
                                .font(.headline)
                            Text(vm.isExtracting ? "Isolating the person…" : "The person you want to add.")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if vm.isExtracting { ProgressView() }
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    @ViewBuilder
    private func placementCanvas(base: UIImage) -> some View {
        GeometryReader { geo in
            ZStack {
                Color.black.opacity(0.92)

                Image(uiImage: base)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                if let subject = vm.extractedSubject {
                    let mapper = AspectFitMapper(imageSize: base.size, canvasSize: geo.size)
                    let baseWidth = mapper.drawRect.width * 0.45
                    let width = baseWidth * vm.scale
                    let aspect = subject.size.height / max(subject.size.width, 1)
                    let height = width * aspect

                    Image(uiImage: subject)
                        .resizable()
                        .scaledToFit()
                        .frame(width: width, height: height)
                        .opacity(vm.opacity)
                        .shadow(radius: vm.shadow * 16)
                        .rotationEffect(.degrees(vm.rotation))
                        .position(
                            x: mapper.drawRect.minX + mapper.drawRect.width * vm.center.x,
                            y: mapper.drawRect.minY + mapper.drawRect.height * vm.center.y
                        )
                        .gesture(
                            DragGesture()
                                .onChanged { value in
                                    let x = (value.location.x - mapper.drawRect.minX) / mapper.drawRect.width
                                    let y = (value.location.y - mapper.drawRect.minY) / mapper.drawRect.height
                                    vm.center = CGPoint(
                                        x: min(1, max(0, x)),
                                        y: min(1, max(0, y))
                                    )
                                }
                        )
                        .simultaneousGesture(
                            MagnificationGesture()
                                .onChanged { value in
                                    vm.scale = min(3.0, max(0.25, scaleStart * value))
                                }
                                .onEnded { _ in
                                    scaleStart = vm.scale
                                }
                        )
                        .simultaneousGesture(
                            RotationGesture()
                                .onChanged { value in
                                    vm.rotation = rotationStart + value.degrees
                                }
                                .onEnded { _ in
                                    rotationStart = vm.rotation
                                }
                        )
                }
            }
        }
        .frame(height: 480)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private var controls: some View {
        VStack(spacing: 12) {
            HStack {
                Text("Size")
                Slider(
                    value: Binding(
                        get: { Double(vm.scale) },
                        set: { vm.scale = CGFloat($0) }
                    ),
                    in: 0.25...3.0
                )
            }

            HStack {
                Text("Rotation")
                Slider(value: $vm.rotation, in: -45...45)
            }

            HStack {
                Text("Opacity")
                Slider(value: $vm.opacity, in: 0.4...1.0)
            }

            HStack {
                Text("Natural shadow")
                Slider(value: $vm.shadow, in: 0...1)
            }

            Picker("Layer order", selection: $vm.layerOrder) {
                ForEach(CompositeRenderer.LayerOrder.allCases) { item in
                    Text(item.rawValue).tag(item)
                }
            }
            .pickerStyle(.segmented)

            HStack {
                Text("Floor line")
                Slider(value: $vm.floorAnchor, in: 0.55...0.98)
            }

            HStack {
                Text("Perspective")
                Slider(value: $vm.perspectiveScale, in: 0...1)
            }

            Text("Use Donor behind base subject when the added person should naturally pass behind the person already in the base photo.")
                .font(.caption)
                .foregroundStyle(.secondary)

            HStack {
                Button("Reset") { vm.resetPlacement() }
                    .buttonStyle(.bordered)

                Spacer()

                Button {
                    vm.render()
                } label: {
                    Label("Create composite", systemImage: "wand.and.stars")
                }
                .buttonStyle(.borderedProminent)
            }
        }
    }
}
