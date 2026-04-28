import React, { useMemo, useState } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Text } from './StyledText';
import { ResearchSurveyPayload } from '../services/api';

type Props = {
  visible: boolean;
  mode: 'consent' | 'survey';
  copy?: { title?: string; body?: string };
  survey?: ResearchSurveyPayload | null;
  loading?: boolean;
  onClose: () => void;
  onAcceptConsent: () => void;
  onDeclineConsent: () => void;
  onSnoozeSurvey: () => void;
  onSubmitSurvey: (answers: Array<{ question_id: number; answer: any }>) => void;
};

export default function ResearchSurveyModal({
  visible,
  mode,
  copy,
  survey,
  loading,
  onClose,
  onAcceptConsent,
  onDeclineConsent,
  onSnoozeSurvey,
  onSubmitSurvey,
}: Props) {
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const questions = useMemo(
    () => (survey?.questions || []).slice().sort((a, b) => a.sort_order - b.sort_order),
    [survey?.questions]
  );

  const setAnswer = (questionId: number, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const toggleMulti = (questionId: number, option: string) => {
    const current = Array.isArray(answers[questionId]) ? answers[questionId] : [];
    if (current.includes(option)) {
      setAnswer(questionId, current.filter((x: string) => x !== option));
    } else {
      setAnswer(questionId, [...current, option]);
    }
  };

  const isMissingRequired = () =>
    questions.some(q => {
      if (!q.is_required) return false;
      const v = answers[q.id];
      if (v == null) return true;
      if (typeof v === 'string' && !v.trim()) return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    });

  const submit = () => {
    if (isMissingRequired()) return;
    const out = Object.entries(answers).map(([qid, answer]) => ({
      question_id: Number(qid),
      answer,
    }));
    onSubmitSurvey(out);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.card}>
          {mode === 'consent' ? (
            <>
              <Text style={s.title}>{copy?.title || 'Help improve study habits'}</Text>
              <Text style={s.body}>
                {copy?.body ||
                  'Take short optional surveys so we can improve Endura for students and amplify our environmental mission.'}
              </Text>
              <View style={s.row}>
                <TouchableOpacity style={s.secondaryBtn} onPress={onClose} disabled={loading}>
                  <Text style={s.secondaryText}>Not now</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostBtn} onPress={onDeclineConsent} disabled={loading}>
                  <Text style={s.ghostText}>No thanks</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.primaryBtn} onPress={onAcceptConsent} disabled={loading}>
                  <Text style={s.primaryText}>{loading ? 'Saving…' : 'I agree'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={s.title}>{survey?.title || 'Quick survey'}</Text>
              {!!survey?.intro_text && <Text style={s.body}>{survey.intro_text}</Text>}
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {questions.map((q, idx) => (
                  <View key={q.id} style={s.questionBlock}>
                    <Text style={s.questionTitle}>
                      {idx + 1}. {q.prompt}
                      {q.is_required ? ' *' : ''}
                    </Text>
                    {(q.question_type === 'single_choice' || q.question_type === 'likert') && (q.options || ['1', '2', '3', '4', '5']).map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[s.option, answers[q.id] === opt && s.optionActive]}
                        onPress={() => setAnswer(q.id, opt)}
                      >
                        <Text style={[s.optionText, answers[q.id] === opt && s.optionTextActive]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                    {q.question_type === 'multi_choice' && (q.options || []).map(opt => {
                      const active = Array.isArray(answers[q.id]) && answers[q.id].includes(opt);
                      return (
                        <TouchableOpacity
                          key={opt}
                          style={[s.option, active && s.optionActive]}
                          onPress={() => toggleMulti(q.id, opt)}
                        >
                          <Text style={[s.optionText, active && s.optionTextActive]}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {q.question_type === 'free_text' && (
                      <TextInput
                        value={answers[q.id] || ''}
                        onChangeText={v => setAnswer(q.id, v)}
                        style={s.input}
                        placeholder="Type your answer..."
                        multiline
                      />
                    )}
                    {q.question_type === 'number' && (
                      <TextInput
                        value={answers[q.id] != null ? String(answers[q.id]) : ''}
                        onChangeText={v => setAnswer(q.id, v)}
                        style={s.input}
                        placeholder="Enter number"
                        keyboardType="numeric"
                      />
                    )}
                  </View>
                ))}
              </ScrollView>
              <View style={s.row}>
                <TouchableOpacity style={s.secondaryBtn} onPress={onSnoozeSurvey} disabled={loading}>
                  <Text style={s.secondaryText}>Remind me later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.primaryBtn, isMissingRequired() && { opacity: 0.45 }]}
                  onPress={submit}
                  disabled={loading || isMissingRequired()}
                >
                  <Text style={s.primaryText}>{loading ? 'Submitting…' : 'Submit survey'}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  title: { fontSize: 19, fontWeight: '700', color: '#2D3B36', marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, color: '#5A6B65', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' },
  primaryBtn: { backgroundColor: '#6B9B9B', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  secondaryBtn: { backgroundColor: '#EEF3EF', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },
  secondaryText: { color: '#2D3B36', fontWeight: '600', fontSize: 13 },
  ghostBtn: { backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D8E2DC' },
  ghostText: { color: '#6B7A72', fontWeight: '600', fontSize: 13 },
  questionBlock: { marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EEF3EF', paddingBottom: 10 },
  questionTitle: { fontSize: 13.5, color: '#2D3B36', marginBottom: 8, fontWeight: '600' },
  option: { borderWidth: 1, borderColor: '#D6E1DA', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 6 },
  optionActive: { borderColor: '#6B9B9B', backgroundColor: '#EAF4F3' },
  optionText: { color: '#4C5E57', fontSize: 13 },
  optionTextActive: { color: '#2D3B36', fontWeight: '700' },
  input: { borderWidth: 1, borderColor: '#D6E1DA', borderRadius: 10, padding: 10, fontSize: 13, color: '#2D3B36', minHeight: 44 },
});

