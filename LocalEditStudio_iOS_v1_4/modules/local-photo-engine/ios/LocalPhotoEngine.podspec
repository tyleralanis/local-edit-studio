Pod::Spec.new do |s|
  s.name             = 'LocalPhotoEngine'
  s.version          = '1.0.0'
  s.summary          = 'Credential-free local photo adjustments for Edit Studio'
  s.description      = 'Applies masked Core Image adjustments without sending the image off device.'
  s.author           = 'Tyler Alanis'
  s.homepage         = 'https://github.com/tyleralanis/local-edit-studio'
  s.platforms        = { :ios => '17.0' }
  s.source           = { :git => 'https://github.com/tyleralanis/local-edit-studio.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
