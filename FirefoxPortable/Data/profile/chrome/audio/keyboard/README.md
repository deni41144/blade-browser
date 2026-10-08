# Dry soft ticks cropped from recorded keyboard attacks

Author: StavSounds. Pack: Mechanical Keyboards.
Pack: https://freesound.org/people/StavSounds/packs/42151/
Retrieved: 2026-10-08.

These are recordings of single key presses on a clicky mechanical keyboard, as described by the author. The audio pages below individually identify their license as Creative Commons 0 (CC0 1.0 Universal), not merely a license on application code.

License: https://creativecommons.org/publicdomain/zero/1.0/
Legal text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

The source files in `source/` are the publicly served official Freesound HQ MP3 previews, not the original uploaded Ogg files (original downloads require an account). Original MP3 files are preserved unchanged with the SHA-256 values below.

Version 2.5.0: these WAVs are **short UI ticks**, not full keyboard presses. Each contains only 37 ms around the main recorded downstroke impact, with no later key release. FFmpeg decodes the original to mono 44100 Hz signed 16-bit PCM. Find the first sample above 20% of the source peak; within the next 35 ms, locate the last sample reaching 95% of that interval's peak, then crop from 0.7 ms before it for 37 ms. Subtract the crop's DC mean, add a 0.2 ms leading fade and a 3 ms trailing fade. No synthesis, pitch shifting, added layers, compressor or musical sequences. Runtime uses linear peak normalization to 0.8; MASTER 0.1125 gives output peak 0.09 at volume 100 (select/close: 0.081).

All themes use naturally different recorded attacks. Every event plays exactly one 37 ms tick. The source key return is omitted, and no additional click is appended.

| WAV | Crop start in original decoded source (ms) | Duration (ms) | Time containing 90% of crop energy (ms) |
| --- | --- | --- | --- |
| 766607.wav | 30.431 | 36.984 | 18.64 |
| 766616.wav | 67.438 | 36.984 | 20.68 |
| 766617.wav | 60.975 | 36.984 | 18.73 |
| 766618.wav | 36.168 | 36.984 | 20.75 |
| 766619.wav | 46.576 | 36.984 | 19.71 |
| 766620.wav | 68.866 | 36.984 | 18.64 |
| 766621.wav | 48.141 | 36.984 | 20.98 |
| 766622.wav | 35.374 | 36.984 | 21.95 |
| 766623.wav | 41.633 | 36.984 | 18.23 |
| 766624.wav | 30.227 | 36.984 | 20.23 |

| Local WAV | Original title | Audio page | Official downloaded preview | SHA-256 of source MP3 |
| --- | --- | --- | --- | --- |
| 766607.wav | Keyboard_Clicky_11 | https://freesound.org/people/StavSounds/sounds/766607/ | https://cdn.freesound.org/previews/766/766607_7862587-hq.mp3 | a7885f2b987671a7f32e38b4f8eebca821ec00f5d381d43bdedd2d61c490c34c |
| 766616.wav | Keyboard_Clicky_19 | https://freesound.org/people/StavSounds/sounds/766616/ | https://cdn.freesound.org/previews/766/766616_7862587-hq.mp3 | dbdb3c11a6412db248e2c55ac946f7fec329f27f4ff655e781ad2d13353fc160 |
| 766617.wav | Keyboard_Clicky_2 | https://freesound.org/people/StavSounds/sounds/766617/ | https://cdn.freesound.org/previews/766/766617_7862587-hq.mp3 | f956ce26cda3c02347beb6e39bdd9d93a38bb7863367198425ccea82f9ee7a07 |
| 766618.wav | Keyboard_Clicky_3 | https://freesound.org/people/StavSounds/sounds/766618/ | https://cdn.freesound.org/previews/766/766618_7862587-hq.mp3 | 3d2086555c0b68c092de8794fa314ef5042dcb84a57e57dba8cc57df8c5a2f2f |
| 766619.wav | Keyboard_Clicky_4 | https://freesound.org/people/StavSounds/sounds/766619/ | https://cdn.freesound.org/previews/766/766619_7862587-hq.mp3 | eee7cc584c3529d554e39080de5a56b086ba06d6a80d4266527d4d87921850ed |
| 766620.wav | Keyboard_Clicky_5 | https://freesound.org/people/StavSounds/sounds/766620/ | https://cdn.freesound.org/previews/766/766620_7862587-hq.mp3 | f80bb680468ddf529a6d970312b2ccbb87682e1d261b1ce1018449f732c5a0fb |
| 766621.wav | Keyboard_Clicky_6 | https://freesound.org/people/StavSounds/sounds/766621/ | https://cdn.freesound.org/previews/766/766621_7862587-hq.mp3 | d7466c0abb1f3d0a198c1a31aae1990036f8bd09ac74960d6ba835476056f624 |
| 766622.wav | Keyboard_Clicky_7 | https://freesound.org/people/StavSounds/sounds/766622/ | https://cdn.freesound.org/previews/766/766622_7862587-hq.mp3 | 28a500c964b56e622e682652651bc42bb646cb96a60304595813c21cb57f6b3e |
| 766623.wav | Keyboard_Clicky_8 | https://freesound.org/people/StavSounds/sounds/766623/ | https://cdn.freesound.org/previews/766/766623_7862587-hq.mp3 | ccb6d6eab32c404b364428ad1305d71201bec26eb775f2aaf278a7a1ce0a5b44 |
| 766624.wav | Keyboard_Clicky_9 | https://freesound.org/people/StavSounds/sounds/766624/ | https://cdn.freesound.org/previews/766/766624_7862587-hq.mp3 | d49bdfcd322aa423b117ebab8e5052b5d88c29a35991523604100ce0f3b78aa6 |

## Opera GX reference (analysis only)

Official reference repository: https://github.com/opera-gaming/gxmods
Official Clicky listing: https://store.gx.me/mods/q3jaz5/clicky/
The listing itself did not expose a playable sample in the fetched page. The official Mod_Template includes original Opera GX keyboard and browser sounds. These were decoded in memory for waveform comparison; none were saved or included in this build. Mod_Template/license.txt has only a license placeholder, so no audio redistribution permission was assumed.

- https://raw.githubusercontent.com/opera-gaming/gxmods/main/documentation/Mod_Template/keyboard/letter_1.wav : file 113 ms; span above 5% of peak 20.5 ms; 90% energy within 5.9 ms after active onset.
- https://raw.githubusercontent.com/opera-gaming/gxmods/main/documentation/Mod_Template/sound/click.mp3 : file 392.9 ms; span above 5% of peak 87.3 ms; 90% energy within 82.2 ms after active onset.
- https://raw.githubusercontent.com/opera-gaming/gxmods/main/documentation/Mod_Template/license.txt

This is a measured duration/envelope comparison, not a claim of subjective listening or exact matching. The approved dry soft tick uses its own CC0 recorded attack, 37 ms long with 90% of energy in 18–22 ms; the full keyboard return has been removed.
