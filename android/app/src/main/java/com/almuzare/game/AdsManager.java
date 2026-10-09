package com.almuzare.game;

import android.app.Activity;
import android.webkit.WebView;
import android.widget.Toast;

import com.google.android.gms.ads.AdError;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.FullScreenContentCallback;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.rewarded.RewardedAd;
import com.google.android.gms.ads.rewarded.RewardedAdLoadCallback;
import com.google.android.ump.ConsentInformation;
import com.google.android.ump.ConsentRequestParameters;
import com.google.android.ump.UserMessagingPlatform;

import org.json.JSONObject;

/**
 * إعلانات AdMob بمكافأة: تحميل مسبق، عرض، وإرجاع النتيجة للعبة.
 * قبل أي إعلان نطلب موافقة المستخدم (UMP) إذا كانت مطلوبة ببلده (أوروبا مثلاً).
 */
public class AdsManager {
    private final Activity activity;
    private final WebView web;
    private final ConsentInformation consent;
    private RewardedAd ad;
    private boolean loading;
    private boolean started;

    AdsManager(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        this.consent = UserMessagingPlatform.getConsentInformation(activity);
        ConsentRequestParameters params = new ConsentRequestParameters.Builder().build();
        consent.requestConsentInfoUpdate(activity, params,
                () -> UserMessagingPlatform.loadAndShowConsentFormIfRequired(activity, formError -> startIfAllowed()),
                requestError -> startIfAllowed());
        // موافقة من جلسة قبل؟ نبدأ على طول بدون انتظار
        startIfAllowed();
    }

    private void startIfAllowed() {
        if (started || !consent.canRequestAds()) return;
        started = true;
        MobileAds.initialize(activity, status -> load());
    }

    /** لازم نعطي المستخدم زر يغيّر موافقته إذا بلده يطلبها */
    boolean privacyOptionsRequired() {
        return consent.getPrivacyOptionsRequirementStatus() == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED;
    }

    void showPrivacyOptions() {
        UserMessagingPlatform.showPrivacyOptionsForm(activity, formError -> startIfAllowed());
    }

    private void load() {
        if (!started || loading || ad != null) return;
        loading = true;
        RewardedAd.load(activity, activity.getString(R.string.admob_rewarded_id), new AdRequest.Builder().build(),
                new RewardedAdLoadCallback() {
                    @Override
                    public void onAdLoaded(RewardedAd rewardedAd) {
                        ad = rewardedAd;
                        loading = false;
                    }

                    @Override
                    public void onAdFailedToLoad(LoadAdError error) {
                        ad = null;
                        loading = false;
                    }
                });
    }

    void show(final String placement) {
        if (ad == null) {
            load();
            Toast.makeText(activity, R.string.ad_not_ready, Toast.LENGTH_SHORT).show();
            send(placement, false);
            return;
        }
        final boolean[] earned = {false};
        final RewardedAd current = ad;
        ad = null;
        current.setFullScreenContentCallback(new FullScreenContentCallback() {
            @Override
            public void onAdDismissedFullScreenContent() {
                send(placement, earned[0]);
                load();
            }

            @Override
            public void onAdFailedToShowFullScreenContent(AdError error) {
                send(placement, false);
                load();
            }
        });
        current.show(activity, reward -> earned[0] = true);
    }

    private void send(String placement, boolean ok) {
        String js = "window.__onAdResult && window.__onAdResult(" + JSONObject.quote(placement) + "," + ok + ")";
        web.post(() -> web.evaluateJavascript(js, null));
    }
}
