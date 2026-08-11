# Model Setup

The app does not bundle model weights.

Apple's Stable Diffusion Swift package expects a Resources folder containing compiled Core ML models plus tokenizer resources.

The official project is:

https://github.com/apple/ml-stable-diffusion

Apple's project documents ready-made Core ML models on Hugging Face and the conversion process for other models.

For image editing, make sure the model pack includes `VAEEncoder.mlmodelc`; without it, the pipeline cannot use a starting image.

For iPhone, prefer:
- iOS 17 or newer
- compressed weights
- chunked UNet
- `cpuAndNeuralEngine`
- `reduceMemory: true`

Do not use a plain PyTorch/Diffusers checkpoint directly in the app. It must be converted to Apple's Core ML resource format first.
