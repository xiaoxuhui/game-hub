plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.xiaoxuhui.gamehub"
    compileSdk = 34
    // Match Kotlin friend-module names when manually verifying signed release APKs.
    testBuildType = providers.gradleProperty("gameHubTestBuildType").orElse("debug").get().also {
        require(it == "debug" || it == "release") { "gameHubTestBuildType must be debug or release" }
    }

    defaultConfig {
        applicationId = "com.xiaoxuhui.gamehub"
        minSdk = 24
        targetSdk = 34
        versionCode = 5
        versionName = "0.4.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        resourceConfigurations += listOf("zh", "en")
    }

    buildTypes {
        debug { isMinifyEnabled = false }
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    // Optional independently produced demo fixture is packaged only in the instrumentation APK.
    sourceSets.getByName("androidTest").assets.srcDir("build/generated/dynamic-device-assets")
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
