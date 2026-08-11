import SwiftUI
import UIKit

struct CompositeLayer: Identifiable {
    let id = UUID()
    var image: UIImage
    var offset: CGSize = .zero
    var scale: CGFloat = 1.0
    var rotation: Angle = .zero
    var opacity: Double = 1.0
}
