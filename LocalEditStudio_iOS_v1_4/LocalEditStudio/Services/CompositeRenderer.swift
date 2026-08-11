import UIKit

enum CompositeRenderer {
    enum LayerOrder: String, CaseIterable, Identifiable {
        case donorInFront = "Donor in front"
        case donorBehindBaseSubject = "Donor behind base subject"

        var id: String { rawValue }
    }

    static func render(
        base: UIImage,
        subject: UIImage,
        normalizedCenter: CGPoint,
        scale: CGFloat,
        rotation: CGFloat,
        opacity: CGFloat,
        shadow: CGFloat,
        floorAnchor: CGFloat,
        perspectiveScale: CGFloat,
        layerOrder: LayerOrder,
        baseSubjectMask: UIImage?
    ) -> UIImage {
        let base = base.normalized()
        let subject = subject.normalized()

        let verticalBias = 1 + (normalizedCenter.y - floorAnchor) * perspectiveScale
        let effectiveScale = max(0.15, scale * verticalBias)

        let format = UIGraphicsImageRendererFormat()
        format.scale = 1

        return UIGraphicsImageRenderer(size: base.size, format: format).image { ctx in
            base.draw(in: CGRect(origin: .zero, size: base.size))

            let targetWidth = base.size.width * 0.45 * effectiveScale
            let aspect = subject.size.height / max(subject.size.width, 1)
            let targetSize = CGSize(width: targetWidth, height: targetWidth * aspect)

            let center = CGPoint(
                x: base.size.width * normalizedCenter.x,
                y: base.size.height * normalizedCenter.y
            )

            func drawDonor() {
                ctx.cgContext.saveGState()
                ctx.cgContext.translateBy(x: center.x, y: center.y)
                ctx.cgContext.rotate(by: rotation)

                if shadow > 0 {
                    ctx.cgContext.setShadow(
                        offset: CGSize(width: 0, height: base.size.height * 0.006),
                        blur: base.size.width * 0.018,
                        color: UIColor.black.withAlphaComponent(shadow * 0.38).cgColor
                    )
                }

                subject.draw(
                    in: CGRect(
                        x: -targetSize.width / 2,
                        y: -targetSize.height / 2,
                        width: targetSize.width,
                        height: targetSize.height
                    ),
                    blendMode: .normal,
                    alpha: opacity
                )
                ctx.cgContext.restoreGState()
            }

            if layerOrder == .donorInFront || baseSubjectMask == nil {
                drawDonor()
            } else {
                drawDonor()

                if let baseSubjectMask,
                   let maskCG = baseSubjectMask.cgImage {
                    ctx.cgContext.saveGState()
                    ctx.cgContext.clip(
                        to: CGRect(origin: .zero, size: base.size),
                        mask: maskCG
                    )
                    base.draw(in: CGRect(origin: .zero, size: base.size))
                    ctx.cgContext.restoreGState()
                }
            }
        }
    }
}
