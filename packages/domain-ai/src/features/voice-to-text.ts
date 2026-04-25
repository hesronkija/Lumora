/**
 * A6: Swahili Voice-to-Text
 * Phase 5 — teacher mobile app only (attendance marking, grade comments).
 *
 * Backed by Whisper large-v3 (in-region, services/inference-whisper).
 * Audio files are processed in-region and purged immediately after
 * transcription unless teacher has explicitly consented to model improvement.
 *
 * Gate: Swahili quality must pass native-reviewer sign-off before GA.
 */

export type VoiceTaskType = 'attendance' | 'grade_comment' | 'note';

export interface VoiceTranscriptionRequest {
  audioS3Key: string;     // uploaded to tenant's S3 prefix; purged post-transcription
  taskType: VoiceTaskType;
  locale: 'sw-TZ' | 'en-TZ';
  consentGranted: boolean; // explicit AI consent per ai_consent table
}

export interface VoiceTranscriptionResult {
  transcript: string;
  confidence: number;       // 0–1
  needsHumanReview: boolean;
  /** For attendance: parsed student names / admission numbers the teacher mentioned */
  parsedEntities?: string[];
}

/** Calls the inference-whisper service over HTTP (internal network only) */
export async function transcribeAudio(
  req: VoiceTranscriptionRequest,
): Promise<VoiceTranscriptionResult> {
  const whisperUrl = process.env['WHISPER_SERVICE_URL'] ?? 'http://inference-whisper:8080';

  if (!req.consentGranted) {
    return {
      transcript: '',
      confidence: 0,
      needsHumanReview: true,
      parsedEntities: [],
    };
  }

  try {
    const resp = await fetch(`${whisperUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        s3_key: req.audioS3Key,
        language: req.locale === 'sw-TZ' ? 'sw' : 'en',
        task: 'transcribe',
        purge_after: true,
      }),
    });

    if (!resp.ok) {
      return { transcript: '', confidence: 0, needsHumanReview: true };
    }

    const data = (await resp.json()) as {
      text: string;
      avg_logprob: number;
      no_speech_prob: number;
    };

    const confidence = Math.max(0, Math.min(1, 1 + data.avg_logprob / 5));
    return {
      transcript: data.text.trim(),
      confidence,
      needsHumanReview: confidence < 0.7 || data.no_speech_prob > 0.3,
    };
  } catch {
    return { transcript: '', confidence: 0, needsHumanReview: true };
  }
}

/** Extracts student admission numbers from a spoken attendance string */
export function parseAttendanceFromTranscript(transcript: string): {
  present: string[];
  absent: string[];
} {
  // Patterns: "absent: John, Mary" / "hawakuja: ..." / "waliokuja: ..."
  const lc = transcript.toLowerCase();
  const absentMatch = lc.match(/(?:absent|hawakuja|hayupo)[:\s]+([^.]+)/i);
  const presentMatch = lc.match(/(?:present|waliokuja|wako)[:\s]+([^.]+)/i);

  const parse = (str?: string) =>
    str ? str.split(/[,;]+/).map(s => s.trim()).filter(Boolean) : [];

  return {
    absent: parse(absentMatch?.[1]),
    present: parse(presentMatch?.[1]),
  };
}
