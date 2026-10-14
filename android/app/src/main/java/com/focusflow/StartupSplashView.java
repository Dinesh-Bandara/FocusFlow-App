package com.focusflow;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.text.SpannableString;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/** Lightweight startup branding: no JS, bitmap decoding, network, or minimum delay. */
public final class StartupSplashView extends FrameLayout {
    private static final String VIEW_TAG = "FocusFlowStartupBranding";
    private final Runnable failSafe = this::removeFromParent;

    private StartupSplashView(Activity activity) {
        super(activity);
        setTag(VIEW_TAG);
        setBackgroundColor(Color.rgb(247, 248, 255));
        setClickable(true);
        setContentDescription("FocusFlow is starting");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            setForceDarkAllowed(false);
        }

        LinearLayout branding = new LinearLayout(activity);
        branding.setOrientation(LinearLayout.VERTICAL);
        branding.setGravity(Gravity.CENTER);
        LayoutParams center = new LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        addView(branding, center);
        branding.setTranslationY(-dp(15));

        ImageView icon = new ImageView(activity);
        icon.setImageResource(R.drawable.focusflow_startup_mark);
        int iconSize = Math.min(Math.round(getResources().getDisplayMetrics().widthPixels * .36f), dp(148));
        branding.addView(icon, new LinearLayout.LayoutParams(iconSize, iconSize));

        TextView title = label(activity, "FocusFlow", 36, "#20283A", true);
        SpannableString titleText = new SpannableString("FocusFlow");
        titleText.setSpan(new ForegroundColorSpan(Color.parseColor("#2563EB")),
                5, 9, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        title.setText(titleText);
        title.setLetterSpacing(-0.017f);
        LinearLayout.LayoutParams titleLayout = new LinearLayout.LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
        titleLayout.topMargin = dp(22);
        branding.addView(title, titleLayout);

        LinearLayout footer = new LinearLayout(activity);
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setGravity(Gravity.CENTER);
        LayoutParams footerLayout = new LayoutParams(
                LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL);
        footerLayout.bottomMargin = dp(24);
        addView(footer, footerLayout);
        footer.addView(label(activity, "powered by", 13, "#727A91", false));
        TextView company = label(activity, "TDBro", 19, "#000000", true);
        SpannableString companyText = new SpannableString("TDBro");
        companyText.setSpan(new ForegroundColorSpan(Color.parseColor("#E53935")),
                2, 5, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        company.setText(companyText);
        company.setPadding(0, dp(2), 0, 0);
        footer.addView(company);

        ViewCompat.setOnApplyWindowInsetsListener(this, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return windowInsets;
        });
    }

    private TextView label(Activity activity, String value, int size, String color, boolean bold) {
        TextView view = new TextView(activity);
        view.setText(value);
        view.setTextColor(Color.parseColor(color));
        view.setTextSize(TypedValue.COMPLEX_UNIT_PX,
                dp(size) * Math.min(getResources().getConfiguration().fontScale, 1.2f));
        view.setTypeface(Typeface.create("sans-serif", bold ? Typeface.BOLD : Typeface.NORMAL));
        view.setIncludeFontPadding(false);
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    public static void show(Activity activity) {
        if (activity.getWindow().getDecorView().findViewWithTag(VIEW_TAG) != null) {
            return;
        }
        StartupSplashView view = new StartupSplashView(activity);
        activity.addContentView(view, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        ViewCompat.requestApplyInsets(view);
        // A ceiling for a crashed JS runtime, not a minimum display duration.
        // This exposes React Native's startup/error UI instead of trapping the user.
        view.postDelayed(view.failSafe, 15000);
    }

    public static void hide(Activity activity) {
        View view = activity.getWindow().getDecorView().findViewWithTag(VIEW_TAG);
        if (view instanceof StartupSplashView) {
            StartupSplashView splash = (StartupSplashView) view;
            splash.postOnAnimation(splash::removeFromParent);
        }
    }

    private void removeFromParent() {
        removeCallbacks(failSafe);
        if (getParent() instanceof ViewGroup) {
            ((ViewGroup) getParent()).removeView(this);
        }
    }

    @Override
    protected void onDetachedFromWindow() {
        removeCallbacks(failSafe);
        super.onDetachedFromWindow();
    }
}
