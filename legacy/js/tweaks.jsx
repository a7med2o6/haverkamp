/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakSlider, TweakRadio */

const { useEffect } = React;

function HavercampTweaks() {
  const [t, setTweak] = useTweaks(window.__tweakDefaults);

  useEffect(() => {
    document.documentElement.style.setProperty('--blur', t.blur + 'px');
  }, [t.blur]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme);
  }, [t.theme]);

  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme — المظهر">
        <TweakRadio
          label="الوضع"
          value={t.theme}
          onChange={(v) => setTweak('theme', v)}
          options={['dark', 'light']}
        />
      </TweakSection>

      <TweakSection label="Glass — تأثير الزجاج">
        <TweakSlider
          label="شدة الـ blur"
          value={t.blur}
          min={0}
          max={60}
          step={1}
          unit="px"
          onChange={(v) => setTweak('blur', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

const root = ReactDOM.createRoot(document.getElementById('tweaks-root'));
root.render(<HavercampTweaks />);
