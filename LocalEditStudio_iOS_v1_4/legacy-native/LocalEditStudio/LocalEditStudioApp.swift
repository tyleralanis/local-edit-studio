import SwiftUI

@main
struct LocalEditStudioApp: App {
    @StateObject private var modelStore = ModelStore()
    @StateObject private var historyStore = HistoryStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(modelStore)
                .environmentObject(historyStore)
        }
    }
}
