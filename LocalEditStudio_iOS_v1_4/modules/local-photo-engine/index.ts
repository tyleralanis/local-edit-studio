import { NativeModule, requireOptionalNativeModule } from "expo";

declare class LocalPhotoEngineNativeModule extends NativeModule {
  apply(
    uri: string,
    operation: string,
    amount: number,
    strokesJSON: string,
    wholeImage: boolean,
  ): Promise<string>;
}

export default requireOptionalNativeModule<LocalPhotoEngineNativeModule>("LocalPhotoEngine");
