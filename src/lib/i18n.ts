export type SupportedLanguage = 'English' | 'Tamil' | 'Hindi' | 'Spanish' | 'French';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'English',
  'Tamil',
  'Hindi',
  'Spanish',
  'French',
];

export const LANGUAGE_DISPLAY_NAMES: Record<SupportedLanguage, string> = {
  English: 'English',
  Tamil: 'தமிழ் (Tamil)',
  Hindi: 'हिन्दी (Hindi)',
  Spanish: 'Español (Spanish)',
  French: 'Français (French)',
};

export const I18N = {
  welcomeTutor: {
    English: (name: string, courseTitle: string) =>
      `Hello ${name}! I am your AI Course Tutor for **${courseTitle}**. I am strictly grounded in your uploaded materials (Textbooks, Lecture Slides, Video Recordings). Ask me any concept question or request an explanation with verified citations!`,
    Tamil: (name: string, courseTitle: string) =>
      `வணக்கம் ${name}! நான் **${courseTitle}** பாடத்திற்கான உங்கள் AI ஆசிரியர். உங்கள் பாடப் புத்தகங்கள் மற்றும் குறிப்புகளின் அடிப்படையில் துல்லியமாக பதிலளிக்கிறேன். ஏதேனும் கேள்விகள் அல்லது விளக்கங்களை கேட்கவும்!`,
    Hindi: (name: string, courseTitle: string) =>
      `नमस्ते ${name}! मैं **${courseTitle}** के लिए आपका AI कोर्स ट्यूटर हूँ। मैं आपके द्वारा अपलोड की गई अध्ययन सामग्री और संदर्भों पर आधारित हूँ। कोई भी वैचारिक प्रश्न पूछें!`,
    Spanish: (name: string, courseTitle: string) =>
      `¡Hola ${name}! Soy tu tutor de IA para **${courseTitle}**. Mis respuestas están estrictamente fundamentadas en tus materiales de estudio subidos. ¡Pregúntame cualquier duda conceptual con citas verificadas!`,
    French: (name: string, courseTitle: string) =>
      `Bonjour ${name} ! Je suis votre tuteur IA pour **${courseTitle}**. Mes réponses s'appuient strictement sur vos documents de cours téléversés. Posez-moi vos questions conceptuelles avec citations vérifiées !`,
  },

  noMaterialsTutor: {
    English: (courseTitle: string) =>
      `No course materials have been uploaded for "${courseTitle}" yet. Please upload your syllabus, textbook, or lecture slides in the Courses tab to enable verified source citations and RAG tutoring.`,
    Tamil: (courseTitle: string) =>
      `"${courseTitle}" பாடத்திற்கு இன்னும் பாடப் பொருட்கள் எதுவும் பதிவேற்றப்படவில்லை. தயவுசெய்து பாடத்திட்டம் அல்லது பாடப்புத்தகங்களை பதிவேற்றி AI பயிற்சியை இயக்கவும்.`,
    Hindi: (courseTitle: string) =>
      `"${courseTitle}" के लिए अभी तक कोई शिक्षण सामग्री अपलोड नहीं की गई है। कृपया प्रामाणिक संदर्भों और AI ट्यूटरिंग के लिए सामग्री अपलोड करें।`,
    Spanish: (courseTitle: string) =>
      `Aún no se han subido materiales para "${courseTitle}". Por favor sube tu programa de estudios o libros en la pestaña Cursos para habilitar la tutoría con citas.`,
    French: (courseTitle: string) =>
      `Aucun support de cours n'a encore été téléversé pour "${courseTitle}". Veuillez téléverser vos documents dans l'onglet Cours pour activer le tutorat avec citations vérifiées.`,
  },

  studyPlanTitles: {
    repairMisconception: {
      English: (title: string) => `Repair Misconception: ${title}`,
      Tamil: (title: string) => `தவறான கருத்தை சரிசெய்க: ${title}`,
      Hindi: (title: string) => `गलत धारणा का सुधार करें: ${title}`,
      Spanish: (title: string) => `Corregir idea errónea: ${title}`,
      French: (title: string) => `Corriger l'incompréhension: ${title}`,
    },
    reviewWeakConcept: {
      English: (name: string) => `Review Weak Concept: ${name}`,
      Tamil: (name: string) => `பலவீனமான கருத்தை மதிப்பாய்வு செய்க: ${name}`,
      Hindi: (name: string) => `कमजोर अवधारणा की समीक्षा करें: ${name}`,
      Spanish: (name: string) => `Revisar concepto débil: ${name}`,
      French: (name: string) => `Réviser le concept fragile: ${name}`,
    },
    flashcards: {
      English: 'Complete SM-2 Flashcard Recall Session',
      Tamil: 'SM-2 ஃபிளாஷ்கார்டு நினைவுகூர்தல் அமர்வை முடிக்கவும்',
      Hindi: 'SM-2 फ्लैशकार्ड पुनरावृत्ति सत्र पूरा करें',
      Spanish: 'Completar sesión de repaso con fichas SM-2',
      French: 'Compléter la session de rappel de flashcards SM-2',
    },
    dailyQuiz: {
      English: 'Daily 5-Question Adaptive Checkpoint',
      Tamil: 'தினசரி 5-கேள்வி தழுவல் மதிப்பீடு',
      Hindi: 'दैनिक 5-प्रश्न अनुकूलन मूल्यांकन',
      Spanish: 'Punto de control adaptativo diario de 5 preguntas',
      French: 'Évaluation adaptative quotidienne de 5 questions',
    },
  },

  studyPlanReasons: {
    misconception: {
      English: 'Invariant violation detected in recent diagnostic quiz attempt.',
      Tamil: 'சமீபத்திய சோதனையில் தவறான அனுமானம் கண்டறியப்பட்டுள்ளது.',
      Hindi: 'हालिया मूल्यांकन में एक वैचारिक त्रुटि पाई गई है।',
      Spanish: 'Se detectó una violación de invariante en el cuestionario reciente.',
      French: 'Violation d’invariant détectée lors du récent test diagnostique.',
    },
    weakConcept: {
      English: (pct: number) => `Bayesian mastery probability is low (${pct}%). Consult AI course tutor.`,
      Tamil: (pct: number) => `கற்றல் தேர்ச்சி குறைவாக உள்ளது (${pct}%). AI ஆசிரியரிடம் விளக்கம் பெறவும்.`,
      Hindi: (pct: number) => `सीखने की दक्षता कम है (${pct}%)। AI ट्यूटर से परामर्श लें।`,
      Spanish: (pct: number) => `El dominio bayesiano es bajo (${pct}%). Consulta al tutor de IA.`,
      French: (pct: number) => `La maîtrise bayésienne est faible (${pct}%). Consultez le tuteur IA.`,
    },
    flashcards: {
      English: 'Ebbinghaus forgetting curve interval reached for due flashcards.',
      Tamil: 'எபிங்ஹாஸ் நினைவக இழப்பு கால அளவு அடைந்துள்ளது.',
      Hindi: 'एबिंगहॉस विस्मरण वक्र अंतराल के अनुसार पुनरावृत्ति आवश्यक है।',
      Spanish: 'Se alcanzó el intervalo de la curva del olvido de Ebbinghaus.',
      French: 'Intervalle de la courbe de l’oubli d’Ebbinghaus atteint.',
    },
    dailyQuiz: {
      English: 'Calibrate Bayesian Learning Twin across recent curriculum nodes.',
      Tamil: 'சமீபத்திய பாடப்பிரிவுகளுக்கான கற்றல் இரட்டையை புதுப்பிக்கவும்.',
      Hindi: 'हाल के पाठ्यक्रम बिंदुओं के लिए लर्निंग ट्विन को कैलिब्रेट करें।',
      Spanish: 'Calibrar el gemelo de aprendizaje bayesiano en nodos recientes.',
      French: 'Calibrer le jumeau d’apprentissage bayésien sur les nœuds récents.',
    },
  },
};
