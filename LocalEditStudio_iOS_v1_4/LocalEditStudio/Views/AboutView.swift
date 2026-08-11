import SwiftUI

struct AboutView: View {
    var body: some View {
        NavigationStack {
            List {
                Section("Designed for phone-only use") {
                    Label("Native SwiftUI interface", systemImage: "iphone")
                    Label("Core ML / Neural Engine inference", systemImage: "cpu")
                    Label("No PC required after model installation", systemImage: "desktopcomputer")
                    Label("Local project history", systemImage: "clock.arrow.circlepath")
                    Label("Automatic foreground person extraction", systemImage: "person.crop.rectangle")
                }

                Section("Professional QA") {
                    Text("""
Version 1.4 can inspect generated results for unselected-area drift, seam mismatch, exposure/color drift, and face position/size changes before export.
""")
                }

                Section("Smart selection") {
                    Text("""
Smart Select can automatically select a person, a foreground object, or the background using Apple's Vision framework. Brush refinement remains available for precise photographer control.
""")
                }

                Section("Preservation-first editing") {
                    Text("""
Local Edit Studio 1.3 adds visible preservation locks for identity, geometry, and scene/background continuity. The editing pipeline can generate multiple internal candidates and keep the one that best preserves natural tone continuity and boundary transitions.
""")
                }

                Section("Combine people") {
                    Text("""
The Combine tab uses Apple's Vision foreground-instance masking to isolate a person from a separate photograph, then lets you position, scale, rotate, and blend that subject into a base image before export.
""")
                }

                Section("Editing workflow") {
                    Text("""
Selected-area editing generates a localized region and composites only your selected pixels back onto the original image. This helps protect faces, backgrounds, and other areas you did not ask to change.
""")
                }

                Section("Quality") {
                    Text("""
Quick, Balanced, and High Detail presets trade generation time for refinement. Results depend heavily on the Core ML model you install and your iPhone's memory and Neural Engine performance.
""")
                }

                Section("Privacy") {
                    Text("""
The app is designed so normal generation can happen on-device. Imported photos and local history do not need to be uploaded to a server.
""")
                }

                Section("Version") {
                    LabeledContent("App", value: "1.4")
                    LabeledContent("Minimum iOS", value: "17.0")
                }
            }
            .navigationTitle("About")
        }
    }
}
