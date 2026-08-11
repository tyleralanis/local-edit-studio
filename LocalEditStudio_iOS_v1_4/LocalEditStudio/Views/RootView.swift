import SwiftUI

struct RootView: View {
    var body: some View {
        TabView {
            EditorView()
                .tabItem { Label("Edit", systemImage: "wand.and.stars") }

            CompositePeopleView()
                .tabItem { Label("Combine", systemImage: "person.2.crop.square.stack") }

            ModelManagerView()
                .tabItem { Label("Models", systemImage: "shippingbox") }

            HistoryView()
                .tabItem { Label("History", systemImage: "clock.arrow.circlepath") }

            AboutView()
                .tabItem { Label("About", systemImage: "info.circle") }
        }
    }
}
