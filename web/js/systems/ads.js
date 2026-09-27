// جسر الإعلانات بمكافأة. بالأندرويد يكلّم الكود الأصلي (MuzareNative)، وبالمتصفح يعرض إعلان تجريبي
const pending = new Map();
let simulator = null;

export function setAdSimulator(fn) {
  simulator = fn;
}

export function nativeAvailable() {
  return typeof window !== 'undefined' && window.MuzareNative && typeof window.MuzareNative.showRewarded === 'function';
}

if (typeof window !== 'undefined') {
  // الكود الأصلي ينادي هذي الدالة بعد ما يخلص الإعلان
  window.__onAdResult = (placement, ok) => {
    const resolve = pending.get(placement);
    if (resolve) {
      pending.delete(placement);
      resolve(!!ok);
    }
  };
}

export function showRewardedAd(placement) {
  return new Promise(resolve => {
    if (nativeAvailable()) {
      pending.set(placement, resolve);
      try {
        window.MuzareNative.showRewarded(placement);
      } catch {
        pending.delete(placement);
        resolve(false);
      }
      // احتياط: لو الكود الأصلي ما رد خلال دقيقتين
      setTimeout(() => {
        if (pending.has(placement)) {
          pending.delete(placement);
          resolve(false);
        }
      }, 120000);
    } else if (simulator) {
      simulator(placement).then(resolve);
    } else {
      resolve(true);
    }
  });
}
