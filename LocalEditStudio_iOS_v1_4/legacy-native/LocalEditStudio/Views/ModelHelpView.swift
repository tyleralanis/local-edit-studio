import SwiftUI

struct ModelHelpView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Compatible model folder")
                    .font(.title2.bold())

                Text("""
Local Edit Studio uses Apple's StableDiffusion Swift package. Import the Resources folder produced by Apple's Core ML Stable Diffusion conversion workflow or a compatible pre-converted Core ML model.
""")

                Text("The folder should include:")
                    .font(.headline)

                Text("""
• TextEncoder.mlmodelc
• UnetChunk1.mlmodelc + UnetChunk2.mlmodelc (preferred on iPhone), or Unet.mlmodelc
• VAEDecoder.mlmodelc
• VAEEncoder.mlmodelc for image-to-image editing
• vocab.json
• merges.txt
""")
                .font(.body.monospaced())

                Text("Why models are not bundled")
                    .font(.headline)

                Text("""
Core ML diffusion models are several gigabytes. Keeping them outside the TestFlight binary makes installation and updates much easier. Put the Resources folder in iCloud Drive or On My iPhone, then import it from the Models tab.
""")

                Link(
                    "Apple ml-stable-diffusion project",
                    destination: URL(string: "https://github.com/apple/ml-stable-diffusion")!
                )

                Text("Important")
                    .font(.headline)

                Text("""
The model must include VAEEncoder.mlmodelc for editing an existing image. Text-to-image-only model packs will install but cannot perform image-to-image edits correctly.
""")
            }
            .padding()
        }
        .navigationTitle("Model setup")
    }
}
