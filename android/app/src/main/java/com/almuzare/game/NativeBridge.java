package com.almuzare.game;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;

/** الدوال اللي تناديها اللعبة من JavaScript عن طريق window.MuzareNative */
public class NativeBridge {
    private final Activity activity;
    private final AdsManager ads;

    NativeBridge(Activity activity, AdsManager ads) {
        this.activity = activity;
        this.ads = ads;
    }

    @JavascriptInterface
    public void showRewarded(final String placement) {
        activity.runOnUiThread(() -> ads.show(placement));
    }

    @JavascriptInterface
    public void scheduleReminder(int minutes) {
        Reminders.schedule(activity, Math.max(1, minutes) * 60_000L);
    }

    @SuppressWarnings("deprecation")
    @JavascriptInterface
    public void vibrate(int ms) {
        Vibrator v = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        if (v == null || !v.hasVibrator()) return;
        int d = Math.max(5, Math.min(ms, 400));
        if (Build.VERSION.SDK_INT >= 26) {
            v.vibrate(VibrationEffect.createOneShot(d, VibrationEffect.DEFAULT_AMPLITUDE));
        } else {
            v.vibrate(d);
        }
    }
}
