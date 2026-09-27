package com.almuzare.game;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

/** يجدول إشعار تذكير بالمكافأة اليومية. */
final class Reminders {
    private static final String PERMISSION = "android.permission.POST_NOTIFICATIONS";

    private Reminders() {
    }

    private static PendingIntent pending(Context c) {
        Intent i = new Intent(c, ReminderReceiver.class);
        return PendingIntent.getBroadcast(c, 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context c, long delayMs) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delayMs, pending(c));
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(pending(c));
    }

    static boolean allowed(Context c) {
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(PERMISSION) == PackageManager.PERMISSION_GRANTED;
    }

    static void requestPermissionIfNeeded(Activity a) {
        if (!allowed(a)) a.requestPermissions(new String[]{PERMISSION}, 7);
    }
}
