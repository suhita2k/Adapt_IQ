'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import { Course, CourseMaterial, MaterialType, Concept, ConceptRelationship } from '@/types';
import {
  BookOpen,
  Plus,
  UploadCloud,
  FileText,
  Presentation,
  Video,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  X,
  Loader2,
  Trash2,
  GitFork,
  Check,
  AlertCircle,
  RefreshCw,
  Cpu,
} from 'lucide-react';

export default function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [relationships, setRelationships] = useState<ConceptRelationship[]>([]);
  const [activeTab, setActiveTab] = useState<'materials' | 'map'>('materials');

  const [loading, setLoading] = useState(true);
  const [processingAi, setProcessingAi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCategory, setNewCategory] = useState('Computer Science');
  const [newDesc, setNewDesc] = useState('');

  // Upload state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadType, setUploadType] = useState<MaterialType>('textbook');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState<'uploading' | 'extracting' | 'ocr_vision' | 'chunking' | 'embedding' | 'indexing' | 'ready'>('uploading');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [inspectConceptModal, setInspectConceptModal] = useState<Concept | null>(null);

  const loadCourses = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getCourses();
      setCourses(data);
      if (data.length > 0) {
        const activeId = selectedCourseId && data.some((c) => c.id === selectedCourseId)
          ? selectedCourseId
          : data[0].id;
        setSelectedCourseId(activeId);
        await loadCourseData(activeId);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  };

  const loadCourseData = async (courseId: string) => {
    try {
      const [sourcesRes, mapRes] = await Promise.all([
        api.getCourseSources(courseId),
        api.getCourseMap(courseId),
      ]);
      setMaterials(sourcesRes.materials || []);
      setConcepts(mapRes.concepts || []);
      setRelationships(mapRes.relationships || []);
    } catch (err: any) {
      console.warn('Error loading course materials/map:', err);
    }
  };

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  const handleSelectCourse = async (cId: string) => {
    setSelectedCourseId(cId);
    await loadCourseData(cId);
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      setLoading(true);
      const created = await api.createCourse({
        title: newTitle.trim(),
        code: newCode.trim() || 'CS101',
        category: newCategory,
        description: newDesc.trim() || 'Comprehensive course syllabus.',
      });

      setCourses((prev) => [created, ...prev]);
      setSelectedCourseId(created.id);
      setMaterials([]);
      setConcepts([]);
      setCreateModalOpen(false);
      setNewTitle('');
      setNewCode('');
      setNewDesc('');
      await loadCourseData(created.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create course');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId || !uploadTitle.trim()) return;

    let stageTimer: any = null;
    try {
      setIsUploading(true);
      setUploadStep('uploading');

      const stageList: ('uploading' | 'extracting' | 'ocr_vision' | 'chunking' | 'embedding' | 'indexing')[] = [
        'uploading',
        'extracting',
        'ocr_vision',
        'chunking',
        'embedding',
        'indexing',
      ];
      let currentStageIdx = 0;
      stageTimer = setInterval(() => {
        currentStageIdx++;
        if (currentStageIdx < stageList.length) {
          setUploadStep(stageList[currentStageIdx]);
        }
      }, 950);

      const formData = new FormData();
      formData.append('title', uploadTitle.trim());
      formData.append('file_type', uploadType);
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      const uploaded = await api.uploadMaterial(selectedCourseId, formData);
      if (stageTimer) clearInterval(stageTimer);
      setUploadStep('ready');
      setMaterials((prev) => [uploaded, ...prev]);
      setUploadSuccess(true);
      await loadCourseData(selectedCourseId);

      setTimeout(() => {
        setUploadSuccess(false);
        setUploadModalOpen(false);
        setUploadTitle('');
        setSelectedFile(null);
        setUploadStep('uploading');
      }, 1500);
    } catch (err: any) {
      if (stageTimer) clearInterval(stageTimer);
      alert(`Upload error: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunAiProcessing = async () => {
    if (!selectedCourseId) return;
    try {
      setProcessingAi(true);
      const res = await api.processCourse(selectedCourseId);
      if (res.success) {
        await loadCourseData(selectedCourseId);
        setActiveTab('map');
      }
    } catch (err: any) {
      alert(`Course processing error: ${err.message}`);
    } finally {
      setProcessingAi(false);
    }
  };

  const getMaterialIcon = (type: string) => {
    switch (type) {
      case 'textbook':
        return <BookOpen className="h-4 w-4 text-[#B1A15A]" />;
      case 'slides':
        return <Presentation className="h-4 w-4 text-[#5E6A7A]" />;
      case 'lecture_video':
        return <Video className="h-4 w-4 text-[#B85C5C]" />;
      default:
        return <FileText className="h-4 w-4 text-[#5E6A7A]" />;
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedCourseId) || courses[0];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#26313D] tracking-tight">
              My Courses &amp; Learning Materials
            </h1>
            <p className="text-xs text-[#6F7782] mt-0.5">
              Upload course textbooks, lecture slides, and transcripts to build your verified student learning twin.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-[#26313D]" />
              New Course
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-[#B85C5C]/30 bg-[#B85C5C]/10 p-4 text-xs text-[#B85C5C] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadCourses}
              className="underline font-bold hover:text-[#26313D]"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#B1A15A] mx-auto" />
            <p className="text-xs font-semibold text-[#6F7782]">Loading course data from Supabase backend...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DDD6C5] bg-[#FFFDF7] p-12 text-center space-y-3">
            <BookOpen className="w-8 h-8 text-[#B1A15A] mx-auto" />
            <h3 className="text-base font-bold text-[#26313D]">No data available yet.</h3>
            <p className="text-xs text-[#6F7782] max-w-sm mx-auto">
              Upload your course materials to get started.
            </p>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D]"
            >
              <Plus className="w-4 h-4" /> Create Course
            </button>
          </div>
        ) : (
          /* Course Tabs & Content */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Course Selector (4 cols) */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#6F7782] px-1">
                Enrolled Courses ({courses.length})
              </h2>

              <div className="space-y-2">
                {courses.map((course) => {
                  const isSelected = course.id === selectedCourseId;
                  return (
                    <div
                      key={course.id}
                      onClick={() => handleSelectCourse(course.id)}
                      className={`cursor-pointer rounded-2xl border p-4 transition-all shadow-xs ${
                        isSelected
                          ? 'border-[#B1A15A] bg-[#FFFDF7] ring-1 ring-[#B1A15A]'
                          : 'border-[#DDD6C5] bg-[#FAF5E8] hover:border-[#B1A15A]/60'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8E0C9] border border-[#DDD6C5]">
                            <BookOpen className="w-4 h-4 text-[#26313D]" />
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-[#6F7782] uppercase">
                              {course.code || 'CS'}
                            </span>
                            <h3 className="text-xs font-bold text-[#26313D] leading-tight line-clamp-1">
                              {course.title}
                            </h3>
                          </div>
                        </div>
                        <span className="rounded bg-[#EFE8D6] px-2 py-0.5 text-[10px] font-bold text-[#5E6A7A] border border-[#DDD6C5]">
                          {course.category}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#6F7782] line-clamp-2 mt-2 leading-relaxed">
                        {course.description}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-[#DDD6C5]/70 flex items-center justify-between text-[11px]">
                        <span className="text-[#6F7782]">
                          {course.materials_count || materials.length} Materials
                        </span>
                        <span className="font-bold text-[#B1A15A]">
                          {course.total_concepts || concepts.length || 8} Concepts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Selected Course Workspace (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              {selectedCourse && (
                <div className="rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-5 sm:p-6 shadow-xs space-y-5">
                  {/* Selected Course Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DDD6C5] pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#26313D] bg-[#E8E0C9] px-2 py-0.5 rounded border border-[#DDD6C5]">
                          {selectedCourse.code || 'CS201'}
                        </span>
                        <span className="text-xs text-[#6F7782]">• {selectedCourse.category}</span>
                      </div>
                      <h2 className="text-xl font-black text-[#26313D] tracking-tight">
                        {selectedCourse.title}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={handleRunAiProcessing}
                        disabled={processingAi}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#5E6A7A] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#4F5A68] transition-all shadow-xs disabled:opacity-50"
                      >
                        {processingAi ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                            <span>Extracting Topology...</span>
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3.5 h-3.5 text-white" />
                            <span>Process with AI</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setUploadModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-3.5 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-[#26313D]" />
                        Upload Material
                      </button>
                    </div>
                  </div>

                  {/* Navigation Tabs: Materials vs Course Map */}
                  <div className="flex items-center gap-3 border-b border-[#DDD6C5] pb-2 text-xs font-bold">
                    <button
                      onClick={() => setActiveTab('materials')}
                      className={`pb-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'materials'
                          ? 'border-b-2 border-[#B1A15A] text-[#26313D]'
                          : 'text-[#6F7782] hover:text-[#26313D]'
                      }`}
                    >
                      <Layers className="w-4 h-4" />
                      <span>Uploaded Materials ({materials.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('map')}
                      className={`pb-2 transition-all flex items-center gap-1.5 ${
                        activeTab === 'map'
                          ? 'border-b-2 border-[#B1A15A] text-[#26313D]'
                          : 'text-[#6F7782] hover:text-[#26313D]'
                      }`}
                    >
                      <GitFork className="w-4 h-4" />
                      <span>Course Map &amp; Topology ({concepts.length})</span>
                    </button>
                  </div>

                  {/* TAB 1: Materials List */}
                  {activeTab === 'materials' && (
                    <div className="space-y-3">
                      {materials.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#DDD6C5] p-8 text-center space-y-2">
                          <UploadCloud className="w-8 h-8 text-[#6F7782] mx-auto" />
                          <p className="text-xs font-bold text-[#26313D]">No materials uploaded yet</p>
                          <p className="text-[11px] text-[#6F7782]">Upload your textbook or slides to begin RAG extraction.</p>
                          <button
                            onClick={() => setUploadModalOpen(true)}
                            className="mt-2 rounded-xl bg-[#B1A15A] px-4 py-1.5 text-xs font-bold text-[#26313D]"
                          >
                            Upload File
                          </button>
                        </div>
                      ) : (
                        materials.map((mat) => (
                          <div
                            key={mat.id}
                            className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3.5 flex items-center justify-between gap-4 transition-all hover:border-[#B1A15A]"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FFFDF7] border border-[#DDD6C5]">
                                {getMaterialIcon(mat.file_type)}
                              </div>
                              <div className="space-y-0.5">
                                <h4 className="text-xs font-bold text-[#26313D]">{mat.title}</h4>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[#6F7782]">
                                  <span className="font-semibold uppercase">{mat.file_type}</span>
                                  <span>•</span>
                                  <span>{(mat.file_size_bytes / (1024 * 1024)).toFixed(1)} MB</span>
                                  {mat.page_count && (
                                    <>
                                      <span>•</span>
                                      <span>{mat.page_count} Pages</span>
                                    </>
                                  )}
                                  <span>•</span>
                                  <span className="text-[#6D9B73] font-bold">
                                    {mat.extracted_chunks_count} Chunks Indexed
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="inline-flex items-center gap-1 rounded-md bg-[#6D9B73]/15 px-2 py-0.5 text-[10px] font-bold text-[#6D9B73] border border-[#6D9B73]/30">
                                <CheckCircle2 className="w-3 h-3" /> Ready
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 2: Visual Course Flow Map */}
                  {activeTab === 'map' && (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3.5 text-xs text-[#6F7782] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <p className="font-bold text-[#26313D] flex items-center gap-1.5">
                            <GitFork className="w-3.5 h-3.5 text-[#B1A15A]" />
                            Visual Course Flow Map &amp; Topological Hierarchy
                          </p>
                          <p className="text-[11px] text-[#6F7782]">
                            Explore Topic &rarr; Subtopic &rarr; Concept &rarr; Prerequisite &rarr; Related dependencies.
                          </p>
                        </div>
                        <span className="font-bold text-[#26313D] shrink-0">{concepts.length} Concept Nodes</span>
                      </div>

                      {concepts.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-[#DDD6C5] bg-[#FAF5E8] p-8 text-center space-y-2">
                          <p className="text-xs font-bold text-[#26313D]">No knowledge graph indexed yet.</p>
                          <p className="text-xs text-[#6F7782]">Upload your course materials to extract the visual flow map.</p>
                          {materials.length > 0 && (
                            <button
                              onClick={handleRunAiProcessing}
                              disabled={processingAi}
                              className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] shadow-xs"
                            >
                              <Sparkles className="w-4 h-4" /> Extract Concepts &amp; Flow Map with AI
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Flow Map Visual Hierarchy */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            {concepts.map((concept, idx) => {
                              const prereqNames = (concept.prerequisites || []).map((pId) => {
                                const found = concepts.find((c) => c.id === pId || c.name.toLowerCase() === pId.toLowerCase());
                                return found ? found.name : pId;
                              });

                              return (
                                <div
                                  key={concept.id}
                                  onClick={() => setInspectConceptModal(concept)}
                                  className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 space-y-3 hover:border-[#B1A15A] hover:shadow-xs transition-all cursor-pointer group"
                                >
                                  {/* Step & Topic Category */}
                                  <div className="flex items-center justify-between border-b border-[#DDD6C5]/50 pb-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="rounded bg-[#E8E0C9] px-2 py-0.5 text-[10px] font-bold text-[#26313D] border border-[#DDD6C5]">
                                        Step {idx + 1}
                                      </span>
                                      <span className="text-[10px] font-bold text-[#6F7782] uppercase tracking-wider">
                                        {concept.category}
                                      </span>
                                      {concept.subtopic && (
                                        <span className="text-[10px] text-[#5E6A7A]">
                                          &bull; {concept.subtopic}
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] text-[#B1A15A] font-bold opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                                        Inspect Flow &rarr;
                                      </span>
                                      <span className="rounded-md bg-[#FFFDF7] px-2 py-0.5 text-[10px] font-bold text-[#B1A15A] border border-[#DDD6C5]">
                                        Lvl {concept.difficulty_level}/5
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="text-sm font-bold text-[#26313D]">{concept.name}</h4>
                                    <p className="text-[11px] text-[#6F7782] mt-1 leading-relaxed">
                                      {concept.description}
                                    </p>
                                  </div>

                                  {/* Learning Objectives */}
                                  {concept.learning_objectives && concept.learning_objectives.length > 0 && (
                                    <div className="rounded-lg bg-[#FFFDF7] p-2.5 border border-[#DDD6C5]/70 space-y-1">
                                      <span className="text-[10px] font-bold text-[#26313D] uppercase tracking-wider block">
                                        Learning Objectives
                                      </span>
                                      <ul className="space-y-0.5 text-[10px] text-[#5E6A7A]">
                                        {concept.learning_objectives.map((obj, oIdx) => (
                                          <li key={oIdx} className="flex items-start gap-1.5">
                                            <span className="text-[#6D9B73] font-bold">&check;</span>
                                            <span>{obj}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Prerequisites & Source Origin */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#DDD6C5]/50 text-[10px] text-[#6F7782]">
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <span className="font-semibold text-[#26313D]">Prerequisites:</span>
                                      {prereqNames.length > 0 ? (
                                        prereqNames.map((pName, pIdx) => (
                                          <span
                                            key={pIdx}
                                            className="rounded bg-[#E8E0C9]/60 px-1.5 py-0.5 font-bold text-[#26313D] border border-[#DDD6C5]/60"
                                          >
                                            {pName}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-[#6D9B73] font-semibold">Foundational (None)</span>
                                      )}
                                    </div>

                                    {concept.source_location && (
                                      <span className="rounded bg-[#FAF5E8] px-2 py-0.5 font-bold text-[#5E6A7A] border border-[#DDD6C5]">
                                        {concept.source_location.includes(':') ? '🎥' : concept.source_location.toLowerCase().includes('slide') ? '📊' : concept.source_location.toLowerCase().includes('fig') ? '🖼️' : '📄'} {concept.source_location}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Course Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26313D]/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#26313D]">Create New Course</h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-[#6F7782] hover:text-[#26313D]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#26313D]">Course Title</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g., Computer Systems Architecture"
                  className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Course Code</label>
                  <input
                    type="text"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value)}
                    placeholder="e.g., CS301"
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Field</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Computer Science"
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#26313D]">Description</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Short summary of course syllabus and topics..."
                  className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-[#5E6A7A] hover:text-[#26313D]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#B1A15A] px-5 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Material Modal */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26313D]/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#26313D]">Upload Course Material</h3>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-[#6F7782] hover:text-[#26313D]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadSuccess ? (
              <div className="rounded-xl border border-[#6D9B73]/40 bg-[#6D9B73]/10 p-6 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-[#6D9B73] mx-auto" />
                <h4 className="text-sm font-bold text-[#26313D]">Material Indexed Successfully</h4>
                <p className="text-xs text-[#6F7782]">
                  Registered in course knowledge graph and ready for AI Tutor retrieval.
                </p>
              </div>
            ) : (
              <form onSubmit={handleUploadMaterial} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Document Title</label>
                  <input
                    type="text"
                    required
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g., Chapter 4 - Tree Balance Invariants"
                    className="w-full rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] px-3.5 py-2 text-xs text-[#26313D] placeholder-[#6F7782] focus:border-[#B1A15A] focus:outline-none focus:ring-1 focus:ring-[#B1A15A]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-[#26313D]">Material Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'textbook', label: 'PDF Textbook', icon: BookOpen },
                      { id: 'slides', label: 'PPTX Slides', icon: Presentation },
                      { id: 'lecture_video', label: 'MP4 Video', icon: Video },
                      { id: 'image', label: 'Figure / Image', icon: Sparkles },
                    ].map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setUploadType(type.id as MaterialType)}
                        className={`rounded-xl border p-2 text-xs font-bold text-center transition-all flex flex-col items-center gap-1 ${
                          uploadType === type.id
                            ? 'border-[#B1A15A] bg-[#E8E0C9] text-[#26313D]'
                            : 'border-[#DDD6C5] bg-[#FAF5E8] text-[#5E6A7A] hover:border-[#B1A15A]'
                        }`}
                      >
                        <type.icon className="w-4 h-4" />
                        <span>{type.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* File picker */}
                <div className="rounded-xl border-2 border-dashed border-[#DDD6C5] bg-[#FAF5E8] p-6 text-center space-y-2 relative">
                  <UploadCloud className="h-8 w-8 text-[#B1A15A] mx-auto" />
                  <p className="text-xs font-bold text-[#26313D]">
                    {selectedFile ? selectedFile.name : 'Select or drop your multimodal course file here'}
                  </p>
                  <p className="text-[10px] text-[#6F7782]">Supports PDF, PPTX, MP4 Video, Technical Figures (PNG/JPG)</p>
                  <input
                    type="file"
                    accept=".pdf,.pptx,.ppt,.docx,.mp4,.webm,.mkv,.mov,.png,.jpg,.jpeg,.webp,.svg,.txt"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                        if (!uploadTitle) {
                          setUploadTitle(e.target.files[0].name.replace(/\.[^/.]+$/, ''));
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                </div>

                {isUploading && (
                  <div className="rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-[#26313D]">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#B1A15A]" />
                        Multimodal Pipeline Status:
                      </span>
                      <span className="uppercase text-[10px] font-black text-[#B1A15A] bg-[#FFFDF7] px-2 py-0.5 rounded border border-[#DDD6C5]">
                        {uploadStep === 'ocr_vision' ? 'OCR / Vision' : uploadStep}
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[9px] text-center font-bold">
                      {[
                        { id: 'uploading', label: 'Upload' },
                        { id: 'extracting', label: 'Extract' },
                        { id: 'ocr_vision', label: 'OCR/Vision' },
                        { id: 'chunking', label: 'Chunk' },
                        { id: 'embedding', label: 'Embed' },
                        { id: 'indexing', label: 'Index' },
                        { id: 'ready', label: 'Ready' },
                      ].map((st, sIdx) => {
                        const stepOrder = ['uploading', 'extracting', 'ocr_vision', 'chunking', 'embedding', 'indexing', 'ready'];
                        const currentIdx = stepOrder.indexOf(uploadStep);
                        const isCurrent = uploadStep === st.id;
                        const isPast = currentIdx > sIdx;
                        return (
                          <div
                            key={st.id}
                            className={`p-1 rounded border transition-all ${
                              isCurrent
                                ? 'bg-[#B1A15A] text-[#26313D] border-[#B1A15A] font-black animate-pulse'
                                : isPast
                                ? 'bg-[#6D9B73]/20 text-[#6D9B73] border-[#6D9B73]/40'
                                : 'bg-[#FFFDF7] text-[#6F7782] border-[#DDD6C5]'
                            }`}
                          >
                            {st.label}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setUploadModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-xs font-bold text-[#5E6A7A] hover:text-[#26313D]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="rounded-xl bg-[#B1A15A] px-5 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] disabled:opacity-50 inline-flex items-center gap-2 shadow-xs"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#26313D]" />
                        <span>Processing Pipeline...</span>
                      </>
                    ) : (
                      'Start Extraction'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Visual Course Flow Map Inspector Modal */}
      {inspectConceptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#26313D]/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xl rounded-2xl border border-[#DDD6C5] bg-[#FFFDF7] p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-[#DDD6C5] pb-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#E8E0C9] px-2 py-0.5 text-[10px] font-bold text-[#26313D] border border-[#DDD6C5]">
                  Flow Node
                </span>
                <h3 className="text-base font-bold text-[#26313D]">{inspectConceptModal.name}</h3>
              </div>
              <button
                onClick={() => setInspectConceptModal(null)}
                className="text-[#6F7782] hover:text-[#26313D]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Interactive Visual Graph Flow: Topic -> Subtopic -> Concept -> Prerequisite -> Related */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-[#6F7782] uppercase tracking-wider block">
                Visual Knowledge Hierarchy Chain
              </span>
              <div className="space-y-1.5 rounded-xl border border-[#DDD6C5] bg-[#FAF5E8] p-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-20 text-[10px] font-bold uppercase text-[#6F7782]">Topic</span>
                  <span className="rounded bg-[#FFFDF7] px-2.5 py-1 font-bold text-[#26313D] border border-[#DDD6C5]">
                    {inspectConceptModal.category || 'General'}
                  </span>
                </div>
                <div className="text-center pl-10 text-[#B1A15A] text-xs font-black">&darr;</div>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-[10px] font-bold uppercase text-[#6F7782]">Subtopic</span>
                  <span className="rounded bg-[#FFFDF7] px-2.5 py-1 font-semibold text-[#26313D] border border-[#DDD6C5]">
                    {inspectConceptModal.subtopic || 'Foundational Principles'}
                  </span>
                </div>
                <div className="text-center pl-10 text-[#B1A15A] text-xs font-black">&darr;</div>
                <div className="flex items-center gap-2">
                  <span className="w-20 text-[10px] font-bold uppercase text-[#6F7782]">Concept</span>
                  <span className="rounded bg-[#E8E0C9] px-2.5 py-1 font-black text-[#26313D] border border-[#DDD6C5]">
                    {inspectConceptModal.name} (Level {inspectConceptModal.difficulty_level}/5)
                  </span>
                </div>
                <div className="text-center pl-10 text-[#B1A15A] text-xs font-black">&darr;</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-20 text-[10px] font-bold uppercase text-[#6F7782]">Prerequisite</span>
                  {(inspectConceptModal.prerequisites || []).length > 0 ? (
                    (inspectConceptModal.prerequisites || []).map((p, idx) => (
                      <span key={idx} className="rounded bg-[#FFFDF7] px-2 py-0.5 font-bold text-[#5E6A7A] border border-[#DDD6C5]">
                        {p}
                      </span>
                    ))
                  ) : (
                    <span className="text-[#6D9B73] font-semibold text-xs">Foundational (No prior prerequisites required)</span>
                  )}
                </div>
                <div className="text-center pl-10 text-[#B1A15A] text-xs font-black">&darr;</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-20 text-[10px] font-bold uppercase text-[#6F7782]">Related Nodes</span>
                  {(inspectConceptModal.subconcepts || []).length > 0 ? (
                    (inspectConceptModal.subconcepts || []).map((sc, idx) => (
                      <span key={idx} className="rounded bg-[#FAF5E8] px-2 py-0.5 font-medium text-[#26313D] border border-[#DDD6C5]">
                        {sc}
                      </span>
                    ))
                  ) : (
                    <span className="text-[#6F7782] italic text-[11px]">Primary invariant node</span>
                  )}
                </div>
              </div>
            </div>

            {/* Description & Origin */}
            <div className="space-y-2 text-xs">
              <span className="text-[10px] font-bold text-[#6F7782] uppercase tracking-wider block">
                Definition &amp; Grounded Invariant
              </span>
              <p className="rounded-xl border border-[#DDD6C5] bg-[#FFFDF7] p-3 text-[#26313D] leading-relaxed">
                {inspectConceptModal.description}
              </p>

              {inspectConceptModal.source_location && (
                <div className="rounded-lg bg-[#FAF5E8] px-3 py-2 border border-[#DDD6C5] flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[#26313D] flex items-center gap-1.5">
                    {inspectConceptModal.source_location.includes(':') ? '🎥' : inspectConceptModal.source_location.toLowerCase().includes('slide') ? '📊' : inspectConceptModal.source_location.toLowerCase().includes('fig') ? '🖼️' : '📄'} Source Origin: {inspectConceptModal.source_location}
                  </span>
                  <span className="font-bold text-[#6D9B73]">Ground Truth Verified</span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDD6C5]">
              <Link
                href="/assessment"
                className="rounded-xl bg-[#B1A15A] px-4 py-2 text-xs font-bold text-[#26313D] hover:bg-[#9E8F4B] transition-all shadow-xs"
              >
                Practice in Adaptive Quiz &rarr;
              </Link>
              <Link
                href="/tutor"
                className="rounded-xl bg-[#FAF5E8] px-4 py-2 text-xs font-bold text-[#26313D] border border-[#DDD6C5] hover:bg-[#E8E0C9] transition-all"
              >
                Ask AI Tutor &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
