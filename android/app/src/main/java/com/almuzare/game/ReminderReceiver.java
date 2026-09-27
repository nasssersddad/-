package com.almuzare.game;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** يطلع إشعار "مكافأتك اليومية جاهزة". */
public class ReminderReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "daily_reward";

    @SuppressWarnings("deprecation")
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Reminders.allowed(context)) return;
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CHANNEL, context.getString(R.string.reminder_channel), NotificationManager.IMPORTANCE_DEFAULT);
            nm.createNotificationChannel(ch);
            b = new Notification.Builder(context, CHANNEL);
        } else {
            b = new Notification.Builder(context);
        }
        b.setSmallIcon(R.drawable.ic_notify)
                .setContentTitle(context.getString(R.string.reminder_title))
                .setContentText(context.getString(R.string.reminder_text))
                .setContentIntent(pi)
                .setAutoCancel(true);
        nm.notify(1, b.build());
    }
}
