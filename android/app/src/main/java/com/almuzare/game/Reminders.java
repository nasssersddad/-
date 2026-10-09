package com.almuzare.game;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

/** يجدول إشعارات التذكير: المكافأة اليومية، والزرع والبيض والورش (اللعبة تحدد النص والوقت). */
final class Reminders {
    private static final String PERMISSION = "android.permission.POST_NOTIFICATIONS";
    /** 1 المكافأة اليومية، 2 الزرع، 3 البيض، 4 الورش */
    static final int[] IDS = {1, 2, 3, 4};

    private Reminders() {
    }

    private static PendingIntent pending(Context c, int id, String title, String text) {
        Intent i = new Intent(c, ReminderReceiver.class);
        i.putExtra(ReminderReceiver.EXTRA_ID, id);
        if (title != null) i.putExtra(ReminderReceiver.EXTRA_TITLE, title);
        if (text != null) i.putExtra(ReminderReceiver.EXTRA_TEXT, text);
        return PendingIntent.getBroadcast(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** تذكير المكافأة اليومية بالنص الافتراضي (احتياط لو اللعبة ما جدولت شي). */
    static void schedule(Context c, long delayMs) {
        schedule(c, 1, delayMs, null, null);
    }

    static void schedule(Context c, int id, long delayMs, String title, String text) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        am.set(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + delayMs, pending(c, id, title, text));
    }

    static void cancel(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int id : IDS) am.cancel(pending(c, id, null, null));
    }

    static boolean allowed(Context c) {
        return Build.VERSION.SDK_INT < 33 || c.checkSelfPermission(PERMISSION) == PackageManager.PERMISSION_GRANTED;
    }

    static void requestPermissionIfNeeded(Activity a) {
        if (!allowed(a)) a.requestPermissions(new String[]{PERMISSION}, 7);
    }
}
