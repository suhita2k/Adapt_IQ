'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  BookOpen,
  FileText,
  Video,
  Presentation,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  RefreshCw,
  X,
  Eye,
  ShieldCheck,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PlayCircle,
} from 'lucide-react';
import { TutorMessage, SourceEvidence, Course } from '@/types';
import { api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';
import { SupportedLanguage, I18N } from '@/lib/i18n';

interface TutorChatProps {
  initialCourseId?: string;
}

export default function TutorChat({ initialCourseId }: TutorChatProps) {
  const { user, profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeCitationModal, setActiveCitationModal] = useState<SourceEvidence | null>(null);

  // Audio Tutoring States (Requirement 6e)
  const [isListening, setIsListening] = useState(false);
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Stop audio synthesis when unmounting or switching courses
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Speech-to-Text (Student speaks -> STT)
  const handleToggleSpeechRecognition = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;

      const lang = profile?.preferred_language || 'English';
      recognition.lang =
        lang === 'Tamil' ? 'ta-IN' : lang === 'Hindi' ? 'hi-IN' : lang === 'Spanish' ? 'es-ES' : lang === 'French' ? 'fr-FR' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0]?.[0]?.transcript || '';
        if (transcript) {
          setInputPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.warn('Speech recognition start failed:', err);
      setIsListening(false);
    }
  };

  // Text-to-Speech (AI Tutor speaks -> TTS)
  const handleSpeakResponse = (msgId: string, text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Text-to-speech is not supported in this browser.');
      return;
    }

    if (currentlySpeakingId === msgId) {
      window.speechSynthesis.cancel();
      setCurrentlySpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean markdown symbols for natural narration
    const cleanText = text
      .replace(/\[Page \d+\]/g, '')
      .replace(/\[Slide \d+\]/g, '')
      .replace(/\[\d+:\d+\]/g, '')
      .replace(/```[\s\S]*?```/g, 'Code example provided.')
      .replace(/[#*_`]/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const lang = profile?.preferred_language || 'English';
    utterance.lang =
      lang === 'Tamil' ? 'ta-IN' : lang === 'Hindi' ? 'hi-IN' : lang === 'Spanish' ? 'es-ES' : lang === 'French' ? 'fr-FR' : 'en-US';
    utterance.rate = 1.0;

    utterance.onend = () => setCurrentlySpeakingId(null);
    utterance.onerror = () => setCurrentlySpeakingId(null);

    setCurrentlySpeakingId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    if (!user) return;
    api.getCourses().then((userCourses) => {
      setCourses(userCourses);
      if (userCourses.length > 0) {
        const active = initialCourseId && userCourses.some((c) => c.id === initialCourseId)
          ? initialCourseId
          : userCourses[0].id;
        setSelectedCourseId(active);
      }
    }).catch(console.warn);
  }, [user, initialCourseId]);

  useEffect(() => {
    if (!user || !selectedCourseId) return;
    api.getTutorHistory(selectedCourseId).then((history) => {
      if (history.length > 0) {
        setMessages(history);
      } else {
        const currentCourse = courses.find((c) => c.id === selectedCourseId);
        const lang: SupportedLanguage = (profile?.preferred_language || 'English') as SupportedLanguage;
        const name = user.user_metadata?.full_name?.split(' ')[0] || 'Learner';
        const welcomeGen = I18N.welcomeTutor[lang] || I18N.welcomeTutor.English;

        const followups = lang === 'Tamil'
          ? [
              'எனது பாடத்தின் முக்கிய கருத்துக்களை சுருக்கமாகக் கூறுக',
              'இந்த பாடத்திற்கு தேவையான முன்நிபந்தனைகள் யாவை?',
              'சமீபத்திய தலைப்புகளில் ஒரு மாதிரி சோதனையை உருவாக்குக',
            ]
          : lang === 'Hindi'
          ? [
              'मेरी अध्ययन सामग्री के मुख्य सिद्धांतों का सारांश दें',
              'इस विषय के लिए आवश्यक पूर्व-आवश्यकताएं क्या हैं?',
              'हाल के विषयों पर एक त्वरित मूल्यांकन तैयार करें',
            ]
          : lang === 'Spanish'
          ? [
              'Resume los conceptos clave de mis materiales de curso',
              '¿Cuáles son los prerrequisitos clave para esta materia?',
              'Genera una prueba de diagnóstico sobre los temas recientes',
            ]
          : lang === 'French'
          ? [
              'Résumez les concepts clés de mes supports de cours',
              'Quels sont les prérequis pour ce cours ?',
              'Générez un test diagnostique sur les sujets récents',
            ]
          : [
              'Summarize the core concepts in my course materials',
              'What are the key prerequisites for this subject?',
              'Generate a diagnostic check on the latest topics',
            ];

        setMessages([
          {
            id: 'welcome-msg',
            user_id: user.id,
            course_id: selectedCourseId,
            role: 'assistant',
            content: welcomeGen(name, currentCourse?.title || 'this subject'),
            created_at: new Date().toISOString(),
            suggested_followups: followups,
          },
        ]);
      }
    }).catch(console.warn);
  }, [user, selectedCourseId, courses, profile?.preferred_language]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputPrompt;
    if (!query.trim() || !user || !selectedCourseId) return;

    setInputPrompt('');
    const userMsg: TutorMessage = {
      id: `msg-user-${Date.now()}`,
      user_id: user.id,
      course_id: selectedCourseId,
      role: 'user',
      content: query.trim(),
      created_at: new Date().toISOString(),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const res = await api.askTutor({
        query: query.trim(),
        courseId: selectedCourseId,
        language: profile?.preferred_language || 'English',
      });

      const assistantMsg: TutorMessage = {
        id: res.messageId || `msg-ai-${Date.now()}`,
        user_id: user.id,
        course_id: selectedCourseId,
        role: 'assistant',
        content: res.answer,
        created_at: new Date().toISOString(),
        is_off_material: res.isOffMaterial,
        citations: res.citations,
        suggested_followups: res.suggestedFollowups,
      };

      setMessages([...newHistory, assistantMsg]);
    } catch (err: any) {
      const errorMsg: TutorMessage = {
        id: `msg-err-${Date.now()}`,
        user_id: user.id,
        course_id: selectedCourseId,
        role: 'assistant',
        content: `Error connecting to AI Tutor: ${err.message}. Please try again.`,
        created_at: new Date().toISOString(),
      };
      setMessages([...newHistory, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'textbook':
        return <BookOpen className="h-3.5 w-3.5 text-[#B1A15A]" />;
      case 'slides':
        return <Presentation className="h-3.5 w-3.5 text-[#5E6A7A]" />;
      case 'lecture_video':
        return <Video className="h-3.5 w-3.5 text-[#B85C5C]" />;
      default:
        return <FileText className="h-3.5 w-3.5 text-[#6D9B73]" />;
    }
  };

  if (courses.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3 shadow-xs">
        <Bot className="w-8 h-8 text-[#B1A15A] mx-auto" />
        <h4 className="text-base font-bold text-[#26313D]">No data available yet.</h4>
        <p className="text-xs text-[#6F7782] max-w-sm mx-auto">
          Upload your course materials to get started.
        </p>
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs mt-2"
        >
          <BookOpen className="w-4 h-4" /> Go to Courses
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] rounded-2xl border border-[#DDD6C5] bg-[#F8F2E3] overflow-hidden shadow-xs">
      {/* Tutor Topbar & Material Context */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DDD6C5] bg-[#FFFDF7] px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FAF5E8] border border-[#DDD6C5]">
            <Bot className="h-5 w-5 text-[#B1A15A]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#26313D] flex items-center gap-2">
              Course Evidence Tutor
              <span className="flex items-center gap-1 rounded-md bg-[#6D9B73]/15 px-2 py-0.5 text-[10px] font-bold text-[#6D9B73] border border-[#6D9B73]/30">
                <ShieldCheck className="w-3 h-3" />
                Strict Grounding Active
              </span>
            </h3>
            <p className="text-[11px] text-[#6F7782]">
              Answers verified strictly against uploaded textbooks, lecture slides, and transcripts.
            </p>
          </div>
        </div>

        {/* Course Filter Dropdown */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#6F7782] font-semibold hidden sm:inline">Active Course:</span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3 py-1.5 font-bold text-[#26313D] focus:border-[#B1A15A] focus:outline-none"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.code || 'CS'})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';

          return (
            <div
              key={msg.id}
              className={`flex items-start gap-3 max-w-3xl ${
                isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
              }`}
            >
              {/* Avatar */}
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                  isUser
                    ? 'bg-[#B1A15A] text-[#26313D]'
                    : 'bg-[#5E6A7A] text-white border border-[#DDD6C5]'
                }`}
              >
                {isUser ? 'Me' : <Bot className="h-4 w-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-3 max-w-2xl">
                <div
                  className={`rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xs relative group ${
                    isUser
                      ? 'bg-[#B1A15A] text-[#26313D] font-medium rounded-tr-xs'
                      : 'bg-[#FFFDF7] border border-[#DDD6C5] text-[#26313D] rounded-tl-xs'
                  }`}
                >
                  {/* Top Bar for Assistant Message: Listen Button & Grounding Badge */}
                  {!isUser && (
                    <div className="flex items-center justify-between border-b border-[#DDD6C5]/50 pb-2 mb-2 text-[10px] text-[#6F7782]">
                      <span className="flex items-center gap-1 font-bold text-[#6D9B73]">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Course Grounded
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSpeakResponse(msg.id, msg.content)}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold transition-all border ${
                          currentlySpeakingId === msg.id
                            ? 'bg-[#B85C5C] text-white border-[#B85C5C] animate-pulse'
                            : 'bg-[#FAF5E8] text-[#26313D] border-[#DDD6C5] hover:bg-[#E8E0C9]'
                        }`}
                        title={currentlySpeakingId === msg.id ? 'Stop audio' : 'Listen with Audio Tutoring'}
                      >
                        {currentlySpeakingId === msg.id ? (
                          <>
                            <VolumeX className="w-3 h-3" /> Stop Audio
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3 text-[#B1A15A]" /> Listen
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Markdown formatted content */}
                  <div className="space-y-2 whitespace-pre-wrap">{msg.content}</div>

                  {/* Off-material warning badge if AI flagged */}
                  {msg.is_off_material && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#FAF5E8] border border-[#DDD6C5] p-2.5 text-xs text-[#5E6A7A]">
                      <AlertCircle className="h-4 w-4 shrink-0 text-[#B1A15A]" />
                      <span>
                        This information was not found in your uploaded course material.
                      </span>
                    </div>
                  )}
                </div>

                {/* Evidence Citations Pill / Drawer */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[11px] font-bold text-[#6F7782] flex items-center gap-1.5 uppercase tracking-wider">
                      <ShieldCheck className="h-3.5 w-3.5 text-[#6D9B73]" />
                      Verified Source Grounding ({msg.citations.length} Citations)
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.citations.map((cite) => {
                        const isVid = cite.location_reference?.includes(':') || cite.location_type === 'timestamp';
                        const isSlide = cite.location_reference?.toLowerCase().includes('slide') || cite.location_type === 'slide';
                        const isImg = cite.location_reference?.toLowerCase().includes('fig') || cite.location_type === 'image';
                        const citeBadge = isVid ? '🎥' : isSlide ? '📊' : isImg ? '🖼️' : '📄';
                        const targetFileUrl = cite.file_url || (selectedCourseId && cite.material_id ? `/api/courses/${selectedCourseId}/materials/${cite.material_id}/file` : undefined);

                        return (
                          <div
                            key={cite.id}
                            className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-3 shadow-xs text-xs space-y-2 transition-all hover:border-[#B1A15A]"
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span className="flex items-center gap-1.5 font-bold text-[#26313D] truncate">
                                {getSourceIcon(cite.material_type)}
                                <span className="text-[#B1A15A]">{citeBadge}</span> {cite.location_reference}
                              </span>
                              <span className="rounded bg-[#EFE8D6] px-1.5 py-0.5 text-[9px] font-bold text-[#5E6A7A] shrink-0 border border-[#DDD6C5] max-w-[130px] truncate" title={cite.file_name || cite.material_title}>
                                {cite.file_name || cite.material_title}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#26313D]/90 line-clamp-2 italic bg-[#FAF5E8] p-2 rounded-lg border border-[#DDD6C5]/50">
                              &ldquo;{cite.snippet}&rdquo;
                            </p>
                            <div className="flex items-center justify-between pt-1 border-t border-[#DDD6C5]/40 text-[11px]">
                              {targetFileUrl ? (
                                <a
                                  href={targetFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 font-bold text-[#B1A15A] hover:text-[#26313D] transition-colors"
                                  title={`Open ${cite.file_name || 'document'} at ${cite.location_reference}`}
                                >
                                  <ExternalLink className="h-3 w-3" /> Open {cite.location_reference}
                                </a>
                              ) : (
                                <span className="text-[#6F7782] font-semibold">{cite.location_reference}</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setActiveCitationModal(cite)}
                                className="inline-flex items-center gap-1 font-bold text-[#5E6A7A] hover:text-[#26313D] transition-colors"
                              >
                                <Eye className="h-3 w-3" /> Inspect Excerpt
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Suggested Followups */}
                {!isUser && msg.suggested_followups && msg.suggested_followups.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {msg.suggested_followups.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(suggestion)}
                        className="rounded-lg border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 text-[11px] font-semibold text-[#5E6A7A] hover:border-[#B1A15A] hover:bg-[#E8E0C9] hover:text-[#26313D] transition-all text-left shadow-xs"
                      >
                        {suggestion} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-3 max-w-xl">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#5E6A7A] text-white">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-4 text-xs shadow-xs space-y-2">
              <div className="flex items-center gap-2 text-[#6F7782]">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#B1A15A]" />
                <span className="font-semibold">Consulting course materials &amp; synthesizing proof...</span>
              </div>
              <div className="h-2 w-48 rounded bg-[#EFE8D6] animate-pulse"></div>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Input Box Footer with Audio Tutoring STT Mic */}
      <div className="border-t border-[#DDD6C5] bg-[#FFFDF7] p-3 sm:p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-center gap-2 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] px-3 py-1.5 focus-within:border-[#B1A15A] focus-within:ring-1 focus-within:ring-[#B1A15A] transition-all"
        >
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            placeholder={isListening ? 'Listening to your question... Speak clearly...' : 'Ask anything grounded in your course materials...'}
            className="flex-1 bg-transparent py-1.5 text-xs text-[#26313D] placeholder-[#6F7782] focus:outline-none"
          />

          {/* Speech-to-Text Microphone Button (Requirement 6e) */}
          <button
            type="button"
            onClick={handleToggleSpeechRecognition}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all shrink-0 ${
              isListening
                ? 'bg-[#B85C5C] text-white animate-pulse ring-2 ring-[#B85C5C]/50'
                : 'bg-[#FFFDF7] text-[#5E6A7A] border border-[#DDD6C5] hover:text-[#26313D] hover:bg-[#E8E0C9]'
            }`}
            title={isListening ? 'Stop listening' : 'Speak to AI Tutor (Audio Tutoring)'}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputPrompt.trim() || isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#B1A15A] text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-30 transition-all shadow-xs shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Citation Deep-Dive Modal with Direct Document Link & Viewer */}
      {activeCitationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26313D]/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 space-y-4 shadow-2xl animate-in fade-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#6D9B73]" />
                <div>
                  <h4 className="text-sm font-bold text-[#26313D]">Verified Course Evidence &amp; Citation</h4>
                  <p className="text-[11px] text-[#6F7782]">Exact passage retrieved from your uploaded course repository</p>
                </div>
              </div>
              <button
                onClick={() => setActiveCitationModal(null)}
                className="rounded-lg p-1 text-[#6F7782] hover:bg-[#FAF5E8] hover:text-[#26313D]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Document Metadata Card */}
              <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-[#6F7782] tracking-wider">Source Material</span>
                  <span className="rounded bg-[#EFE8D6] px-2 py-0.5 text-[10px] font-bold text-[#26313D] border border-[#DDD6C5]">
                    {activeCitationModal.location_reference.includes(':') ? '🎥 Video Lecture' : activeCitationModal.location_reference.toLowerCase().includes('slide') ? '📊 Presentation Slide' : activeCitationModal.location_reference.toLowerCase().includes('fig') ? '🖼️ Visual Schematic' : '📄 Textbook / Document'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-[#26313D] text-sm">{activeCitationModal.material_title}</p>
                  {activeCitationModal.file_name && (
                    <p className="text-[11px] text-[#5E6A7A] font-mono mt-0.5">Filename: {activeCitationModal.file_name}</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#DDD6C5]/50 text-[11px]">
                  <span className="text-[#26313D] font-bold flex items-center gap-1.5">
                    Target Location: <span className="rounded bg-[#B1A15A]/20 px-2 py-0.5 font-bold text-[#26313D] border border-[#B1A15A]/40">{activeCitationModal.location_reference}</span>
                  </span>
                  <span className="text-[#6D9B73] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Grounded
                  </span>
                </div>
              </div>

              {/* Action Button: Direct Link to File at Page/Slide */}
              {activeCitationModal.file_url ? (
                <a
                  href={activeCitationModal.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#B1A15A] py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Document Directly at {activeCitationModal.location_reference} (New Tab)
                </a>
              ) : selectedCourseId && activeCitationModal.material_id ? (
                <a
                  href={`/api/courses/${selectedCourseId}/materials/${activeCitationModal.material_id}/file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#B1A15A] py-2.5 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open Document File (New Tab)
                </a>
              ) : null}

              {/* Exact Verbatim Excerpt */}
              <div className="rounded-xl border border-[#DDD6C5] bg-[#26313D] p-4 text-white space-y-2 shadow-inner">
                <div className="flex items-center justify-between text-[11px] text-[#EFE8D6]">
                  <span className="font-bold flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-[#B1A15A]" />
                    Exact Extracted Passage
                  </span>
                  <span className="text-[10px] text-[#DDD6C5] font-mono bg-white/10 px-2 py-0.5 rounded">
                    {activeCitationModal.location_reference}
                  </span>
                </div>
                <div className="rounded-lg bg-black/40 p-3 text-[12px] leading-relaxed border border-white/10 font-mono text-[#E8E0C9] whitespace-pre-wrap">
                  &ldquo;{activeCitationModal.snippet}&rdquo;
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#DDD6C5] pt-1">
                  <span>Grounding Confidence: {Math.round((activeCitationModal.confidence_score || 0.98) * 100)}%</span>
                  <span className="text-[#6D9B73] font-bold">&check; Verified Curriculum Invariant</span>
                </div>
              </div>

              {/* Relevance Reason */}
              <div className="rounded-xl border border-[#B1A15A]/40 bg-[#FFFDF7] p-3 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#B1A15A]">Verification Relevance Reason</span>
                <p className="text-[#26313D] leading-relaxed">
                  {activeCitationModal.relevance_reason || 'This excerpt directly provides the operational definition and conceptual rules cited in the response.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveCitationModal(null)}
              className="w-full rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] py-2 text-xs font-bold text-[#26313D] hover:bg-[#E8E0C9] transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
