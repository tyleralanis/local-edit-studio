import SwiftUI

enum StudioTheme {
    static let corner: CGFloat = 18
    static let cardPadding: CGFloat = 16

    static let background = LinearGradient(
        colors: [
            Color(uiColor: .systemBackground),
            Color.accentColor.opacity(0.055)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

struct StudioCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        content
            .padding(StudioTheme.cardPadding)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: StudioTheme.corner))
            .overlay(
                RoundedRectangle(cornerRadius: StudioTheme.corner)
                    .stroke(.primary.opacity(0.06), lineWidth: 1)
            )
    }
}

struct StatusPill: View {
    let text: String
    let systemImage: String
    let tint: Color

    var body: some View {
        Label(text, systemImage: systemImage)
            .font(.caption.weight(.semibold))
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .foregroundStyle(tint)
            .background(tint.opacity(0.12), in: Capsule())
    }
}
