import SwiftUI

struct MaskStroke: Identifiable, Hashable {
    let id = UUID()
    var points: [CGPoint]
    var width: CGFloat
    var isEraser: Bool
}
