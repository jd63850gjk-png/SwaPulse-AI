# Lottie animations

Place downloaded Lottie animation JSON files in this directory so they can be
served from the app's `/animations/` public URL path.

The reusable `LottieVisual` component looks for `health-network.json` by
default, so the expected default file name is:

```text
public/animations/health-network.json
```

Pass another public URL through the component's `src` prop when using a
different animation file.
