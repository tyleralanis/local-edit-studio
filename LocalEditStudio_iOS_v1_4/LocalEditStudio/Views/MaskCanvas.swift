import SwiftUI

struct MaskCanvas: View {
    let image: UIImage
    @Binding var strokes: [MaskStroke]
    @Binding var brushSize: Double
    @Binding var isErasing: Bool

    @State private var currentPoints: [CGPoint] = []

    var body: some View {
        GeometryReader { geo in
            let fitted = AspectFitMapper(imageSize: image.size, canvasSize: geo.size)

            ZStack {
                Color.black.opacity(0.92)

                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                Canvas { context, size in
                    for stroke in strokes {
                        draw(stroke: stroke, in: &context, mapper: fitted)
                    }

                    if !currentPoints.isEmpty {
                        let preview = MaskStroke(
                            points: currentPoints,
                            width: brushSize,
                            isEraser: isErasing
                        )
                        draw(stroke: preview, in: &context, mapper: fitted)
                    }
                }
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if fitted.contains(canvasPoint: value.location) {
                                currentPoints.append(fitted.imagePoint(fromCanvas: value.location))
                            }
                        }
                        .onEnded { _ in
                            guard currentPoints.count > 0 else { return }
                            strokes.append(
                                MaskStroke(
                                    points: currentPoints,
                                    width: brushSize,
                                    isEraser: isErasing
                                )
                            )
                            currentPoints = []
                        }
                )
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func draw(stroke: MaskStroke, in context: inout GraphicsContext, mapper: AspectFitMapper) {
        guard !stroke.points.isEmpty else { return }

        var path = Path()
        path.move(to: mapper.canvasPoint(fromImage: stroke.points[0]))
        for p in stroke.points.dropFirst() {
            path.addLine(to: mapper.canvasPoint(fromImage: p))
        }

        let scale = min(mapper.drawRect.width / image.size.width,
                        mapper.drawRect.height / image.size.height)
        let lineWidth = max(2, stroke.width * scale)

        if stroke.isEraser {
            context.blendMode = .destinationOut
            context.stroke(
                path,
                with: .color(.black),
                style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
            )
            context.blendMode = .normal
        } else {
            context.stroke(
                path,
                with: .color(.green.opacity(0.52)),
                style: StrokeStyle(lineWidth: lineWidth, lineCap: .round, lineJoin: .round)
            )
        }
    }
}

struct AspectFitMapper {
    let imageSize: CGSize
    let canvasSize: CGSize
    let drawRect: CGRect

    init(imageSize: CGSize, canvasSize: CGSize) {
        self.imageSize = imageSize
        self.canvasSize = canvasSize

        let scale = min(canvasSize.width / imageSize.width, canvasSize.height / imageSize.height)
        let w = imageSize.width * scale
        let h = imageSize.height * scale
        let x = (canvasSize.width - w) / 2
        let y = (canvasSize.height - h) / 2
        self.drawRect = CGRect(x: x, y: y, width: w, height: h)
    }

    func contains(canvasPoint: CGPoint) -> Bool {
        drawRect.contains(canvasPoint)
    }

    func imagePoint(fromCanvas p: CGPoint) -> CGPoint {
        let nx = (p.x - drawRect.minX) / drawRect.width
        let ny = (p.y - drawRect.minY) / drawRect.height
        return CGPoint(x: nx * imageSize.width, y: ny * imageSize.height)
    }

    func canvasPoint(fromImage p: CGPoint) -> CGPoint {
        let nx = p.x / imageSize.width
        let ny = p.y / imageSize.height
        return CGPoint(x: drawRect.minX + nx * drawRect.width,
                       y: drawRect.minY + ny * drawRect.height)
    }
}
