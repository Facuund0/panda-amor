"""
Prueba en la compu cómo suena la voz del panda con distintos tonos.
Genera voz_1.25.wav, voz_1.35.wav, ... con el mismo truco que usa el celular.

  pip install piper-tts numpy
  # bajar y descomprimir el modelo (una vez):
  # https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-es_AR-daniela-high.tar.bz2
  python probar_voz_nino.py "Hola, te extrañé mucho"
"""
import sys, wave
import numpy as np
from piper import PiperVoice, SynthesisConfig

MODELO = "vits-piper-es_AR-daniela-high/es_AR-daniela-high.onnx"
texto = sys.argv[1] if len(sys.argv) > 1 else "Hola. Te extrañé mucho. ¿Me das de comer?"
voz = PiperVoice.load(MODELO)
for tono in (1.2, 1.35, 1.5, 1.65):
    cfg = SynthesisConfig(length_scale=tono / 1.06, noise_scale=0.6, noise_w_scale=0.8)  # más lenta…
    audio = np.concatenate([c.audio_int16_array for c in voz.synthesize(texto, syn_config=cfg)])
    with wave.open(f"voz_{tono}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2)
        w.setframerate(int(voz.config.sample_rate * tono))  # …y reproducida más rápido = más aguda
        w.writeframes(audio.tobytes())
    print("listo:", f"voz_{tono}.wav")
