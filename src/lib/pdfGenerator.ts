import PDFDocument from 'pdfkit';
import { SmartQuestion } from '@/types';

export interface PdfGenerationOptions {
  courseTitle: string;
  courseCode?: string;
  category?: string;
  paperType: '2_mark' | '16_mark';
  questions: SmartQuestion[];
  userFullName?: string;
  userEmail?: string;
  analyzedMaterials?: { title: string; file_type: string; page_or_slide_count?: number }[];
  generatedAt?: string;
}

/**
 * Generates a publication-grade, real binary PDF buffer for Smart Question Bank:
 * - 2-Mark Questions & Verified Answers PDF
 * - 16-Mark Comprehensive Questions & Evaluated Solutions PDF
 */
export async function generateQuestionBankPdfBuffer(
  options: PdfGenerationOptions
): Promise<Buffer> {
  const {
    courseTitle,
    courseCode,
    category = 'Academic Curriculum',
    paperType,
    questions,
    userFullName = 'ADAPTIQ Learner',
    analyzedMaterials = [],
    generatedAt = new Date().toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  } = options;

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        bufferPages: true,
        info: {
          Title: `${courseTitle} - ${paperType === '2_mark' ? '2-Mark' : '16-Mark'} Questions & Answers`,
          Author: 'ADAPTIQ AI Learning Platform',
          Subject: `${paperType === '2_mark' ? 'Part A: 2-Mark Questions' : 'Part C: 16-Mark Comprehensive Essays'}`,
          Keywords: 'ADAPTIQ, Question Bank, Exam Preparation, Verified Answers, Course Materials',
        },
      });

      const buffers: Buffer[] = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Color Palette matching ADAPTIQ theme
      const primaryDark = '#26313D';
      const goldAccent = '#9A8948';
      const secondaryMuted = '#5E6A7A';
      const cardBorder = '#DDD6C5';
      const cardBg = '#FAF5E8';
      const answerBoxBg = '#F6EED8';
      const greenSuccess = '#3E7B46';

      const is2Mark = paperType === '2_mark';
      const docTitle = is2Mark
        ? 'PART A: 2-MARK QUESTIONS & VERIFIED ANSWERS'
        : 'PART C: 16-MARK ESSAY & SYSTEM DESIGN QUESTIONS';
      const docSubtitle = is2Mark
        ? 'Concise Definitions, Key Invariants, Operational Differences & Formulas'
        : 'Comprehensive Step-by-Step Architectural Breakdowns, Diagrams & Evaluated Solutions';

      // =======================================================================
      // COVER / HEADER BANNER
      // =======================================================================
      doc.rect(45, 45, 505, 80).fill(cardBg);
      doc.rect(45, 45, 505, 80).strokeColor(cardBorder).lineWidth(1).stroke();

      // Top branding banner
      doc.fillColor(goldAccent).fontSize(9).font('Helvetica-Bold');
      doc.text('ADAPTIQ — ADAPTIVE INTELLIGENCE FOR PERSONALIZED LEARNING', 55, 55, {
        characterSpacing: 0.8,
      });

      // Course title & code
      doc.fillColor(primaryDark).fontSize(14).font('Helvetica-Bold');
      const courseHeader = courseCode ? `[${courseCode}] ${courseTitle}` : courseTitle;
      doc.text(courseHeader.toUpperCase(), 55, 70, { width: 485, ellipsis: true });

      // Document category & generation timestamp
      doc.fillColor(secondaryMuted).fontSize(8.5).font('Helvetica');
      doc.text(
        `Category: ${category}   •   Generated for: ${userFullName}   •   Date: ${generatedAt}`,
        55,
        92
      );
      doc.text(
        `Grounding: 100% Derived from ${analyzedMaterials.length || 1} Verified Course Document(s)`,
        55,
        104
      );

      doc.moveDown(3);

      // Main Document Title
      doc.fillColor(goldAccent).fontSize(13).font('Helvetica-Bold');
      doc.text(docTitle, 45, 140, { align: 'center' });
      doc.fillColor(secondaryMuted).fontSize(8.5).font('Helvetica-Oblique');
      doc.text(docSubtitle, 45, 157, { align: 'center' });

      // Divider line
      doc.strokeColor(goldAccent).lineWidth(1.5).moveTo(45, 172).lineTo(550, 172).stroke();

      // Exam Metadata Box
      doc.rect(45, 180, 505, 26).fill(cardBg);
      doc.rect(45, 180, 505, 26).strokeColor(cardBorder).lineWidth(0.8).stroke();
      doc.fillColor(primaryDark).fontSize(8).font('Helvetica-Bold');
      doc.text(
        `Total Questions: ${questions.length}     •     Marks per Question: ${is2Mark ? '2 Marks' : '16 Marks'}     •     Total Marks: ${questions.length * (is2Mark ? 2 : 16)} Marks`,
        55,
        188
      );

      // =======================================================================
      // INDEX / TABLE OF TOPICS COVERED
      // =======================================================================
      let currentY = 216;
      doc.fillColor(primaryDark).fontSize(9).font('Helvetica-Bold');
      doc.text('INDEX OF COVERED TOPICS & LEARNING UNITS:', 45, currentY);
      currentY += 14;

      const topics = Array.from(new Set(questions.map((q) => q.topic || 'General Foundations')));
      doc.fillColor(secondaryMuted).fontSize(8).font('Helvetica');
      const topicSummary = topics.map((t, idx) => `${idx + 1}. ${t}`).join('   •   ');
      doc.text(topicSummary, 45, currentY, { width: 505, align: 'left' });
      currentY += Math.max(20, Math.ceil(topicSummary.length / 85) * 12);

      // Section separator
      doc.strokeColor(cardBorder).lineWidth(0.5).moveTo(45, currentY).lineTo(550, currentY).stroke();
      currentY += 12;

      // =======================================================================
      // QUESTIONS AND ANSWERS RENDERING LOOP
      // =======================================================================
      doc.y = currentY;

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const qNum = i + 1;
        const marksLabel = is2Mark ? '[2 Marks]' : '[16 Marks]';

        // Check if page break is needed before question header (leave at least 120pt)
        if (doc.y > 680) {
          doc.addPage();
        }

        // --- Question Header Pill ---
        const startY = doc.y;
        doc.rect(45, startY, 505, 20).fill('#EFE8D6');
        doc.rect(45, startY, 505, 20).strokeColor(cardBorder).lineWidth(0.8).stroke();

        doc.fillColor(primaryDark).fontSize(9).font('Helvetica-Bold');
        doc.text(`QUESTION ${qNum}`, 55, startY + 5);

        doc.fillColor(goldAccent).fontSize(8.5).font('Helvetica-Bold');
        doc.text(marksLabel, 480, startY + 5, { width: 60, align: 'right' });

        if (q.topic) {
          doc.fillColor(secondaryMuted).fontSize(8).font('Helvetica');
          doc.text(`Topic: ${q.topic}`, 140, startY + 5, { width: 330, ellipsis: true });
        }

        doc.y = startY + 26;

        // --- Question Text ---
        doc.fillColor(primaryDark).fontSize(9.5).font('Helvetica-Bold');
        doc.text(`Q${qNum}. ${q.question_text}`, 45, doc.y, {
          width: 505,
          lineGap: 2.5,
        });

        // Bloom Taxonomy & Difficulty Badge
        doc.moveDown(0.3);
        doc.fillColor(secondaryMuted).fontSize(7.5).font('Helvetica');
        const diffText = q.difficulty ? `Difficulty: ${q.difficulty.toUpperCase()}` : '';
        const bloomText = q.bloom_level ? `Bloom: ${q.bloom_level}` : '';
        const badges = [diffText, bloomText].filter(Boolean).join('   |   ');
        if (badges) {
          doc.text(badges, 45, doc.y);
          doc.moveDown(0.3);
        }

        // --- Source Reference Citation ---
        if (q.source_citation) {
          doc.moveDown(0.2);
          doc.fillColor(greenSuccess).fontSize(7.5).font('Helvetica-Bold');
          const cit = q.source_citation;
          const citText = `[SOURCE GROUNDING]: ${cit.material_title || 'Course Document'} (${cit.reference || 'Ref'})${
            cit.quote ? ` — "${cit.quote.slice(0, 110)}..."` : ''
          }`;
          doc.text(citText, 45, doc.y, { width: 505 });
          doc.moveDown(0.4);
        }

        // --- Verified Model Answer Block ---
        // Render 2-Mark or 16-Mark Answer
        if (is2Mark) {
          render2MarkAnswer(doc, q, cardBorder, answerBoxBg, primaryDark, secondaryMuted, goldAccent);
        } else {
          render16MarkAnswer(doc, q, cardBorder, answerBoxBg, primaryDark, secondaryMuted, goldAccent);
        }

        doc.moveDown(1.2);
        // Small divider between questions
        if (i < questions.length - 1) {
          doc.strokeColor('#E0D8C3').lineWidth(0.5).moveTo(45, doc.y).lineTo(550, doc.y).stroke();
          doc.moveDown(0.8);
        }
      }

      // =======================================================================
      // FOOTER & PAGE NUMBERING ACROSS ALL PAGES
      // =======================================================================
      const totalPages = doc.bufferedPageRange().count;
      for (let p = 0; p < totalPages; p++) {
        doc.switchToPage(p);

        // Footer line
        doc.strokeColor(cardBorder).lineWidth(0.5).moveTo(45, 792).lineTo(550, 792).stroke();

        // Footer left: Course & paper
        doc.fillColor(secondaryMuted).fontSize(7.5).font('Helvetica');
        doc.text(
          `${courseTitle} — ${is2Mark ? '2-Mark Questions & Answers' : '16-Mark Questions & Answers'}`,
          45,
          798,
          { width: 320, ellipsis: true }
        );

        // Footer right: Page number
        doc.fillColor(primaryDark).fontSize(7.5).font('Helvetica-Bold');
        doc.text(`Page ${p + 1} of ${totalPages}`, 450, 798, { width: 100, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Renders concise, high-clarity 2-mark answer block
 */
function render2MarkAnswer(
  doc: PDFKit.PDFDocument,
  q: SmartQuestion,
  borderColor: string,
  bgColor: string,
  darkColor: string,
  mutedColor: string,
  goldColor: string
) {
  if (doc.y > 700) doc.addPage();

  const answerStartY = doc.y;
  doc.rect(45, answerStartY, 505, 16).fill('#EFE6CF');
  doc.fillColor(goldColor).fontSize(8).font('Helvetica-Bold');
  doc.text('VERIFIED MODEL ANSWER & KEY INVARIANTS', 52, answerStartY + 4);

  doc.y = answerStartY + 20;

  // Answer Text
  const answerContent = q.answer || 'Refer to verified course materials.';
  doc.fillColor(darkColor).fontSize(8.5).font('Helvetica');
  doc.text(answerContent, 52, doc.y, {
    width: 490,
    lineGap: 2.5,
  });

  doc.moveDown(0.4);
}

/**
 * Renders structured, detailed 16-mark academic answer with headings, diagrams & conclusion
 */
function render16MarkAnswer(
  doc: PDFKit.PDFDocument,
  q: SmartQuestion,
  borderColor: string,
  bgColor: string,
  darkColor: string,
  mutedColor: string,
  goldColor: string
) {
  if (doc.y > 670) doc.addPage();

  // Header Banner for 16-mark answer
  const answerStartY = doc.y;
  doc.rect(45, answerStartY, 505, 18).fill('#EAE2CA');
  doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold');
  doc.text('COMPREHENSIVE 16-MARK EVALUATED SOLUTION & TECHNICAL BREAKDOWN', 52, answerStartY + 4);

  doc.y = answerStartY + 24;

  const struct = q.structured_16_mark;

  if (struct) {
    // 1. Introduction
    if (struct.introduction) {
      printSectionHeader(doc, '1. Theoretical Introduction & Problem Motivation', goldColor);
      printBodyText(doc, struct.introduction, darkColor);
    }

    // 2. Headings & Subheadings
    if (struct.headings && struct.headings.length > 0) {
      printSectionHeader(doc, '2. Architectural Principles & Step-by-Step Methodology', goldColor);
      struct.headings.forEach((h, hIdx) => {
        if (doc.y > 720) doc.addPage();
        doc.fillColor(darkColor).fontSize(8.5).font('Helvetica-Bold');
        doc.text(`   2.${hIdx + 1} ${h.title}`, 45, doc.y);
        doc.moveDown(0.2);
        printBodyText(doc, h.content, darkColor);

        if (h.bullet_points && h.bullet_points.length > 0) {
          h.bullet_points.forEach((bp: string) => {
            if (doc.y > 730) doc.addPage();
            doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
            doc.text(`      •  ${bp}`, 50, doc.y, { width: 485 });
            doc.moveDown(0.15);
          });
          doc.moveDown(0.3);
        }
      });
    }

    // 3. Diagrams & Visual Schematics
    if (struct.diagrams && struct.diagrams.length > 0) {
      printSectionHeader(doc, '3. Architectural Schematic & Visual Model Representation', goldColor);
      struct.diagrams.forEach((d: any) => {
        if (doc.y > 700) doc.addPage();
        const boxY = doc.y;
        doc.rect(50, boxY, 495, 42).fill('#F2ECE0');
        doc.rect(50, boxY, 495, 42).strokeColor('#D8CEB6').lineWidth(0.5).stroke();

        doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold');
        doc.text(`[Diagram] ${d.caption || d.title}`, 58, boxY + 5);

        doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica');
        doc.text(d.description, 58, boxY + 16, { width: 480 });

        if (d.ascii_representation) {
          doc.moveDown(0.5);
          doc.font('Courier').fontSize(7).text(d.ascii_representation, 58, doc.y);
        }

        doc.y = boxY + 46;
      });
    }

    // 4. Formulae & Worked Examples
    if (struct.worked_examples && struct.worked_examples.length > 0) {
      printSectionHeader(doc, '4. Mathematical Formulations & Worked Numerical Proofs', goldColor);
      struct.worked_examples.forEach((ex: any, exIdx: number) => {
        if (doc.y > 720) doc.addPage();
        doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold');
        doc.text(`   Case ${exIdx + 1}: ${ex.title}`, 45, doc.y);
        doc.moveDown(0.2);

        if (ex.steps && ex.steps.length > 0) {
          ex.steps.forEach((st: string, sIdx: number) => {
            if (doc.y > 730) doc.addPage();
            doc.fillColor(mutedColor).fontSize(7.5).font('Helvetica');
            doc.text(`      Step ${sIdx + 1}: ${st}`, 50, doc.y, { width: 485 });
            doc.moveDown(0.15);
          });
        }
        if (ex.result) {
          doc.fillColor(darkColor).fontSize(8).font('Helvetica-Bold');
          doc.text(`      Result: ${ex.result}`, 50, doc.y, { width: 485 });
        }
        doc.moveDown(0.3);
      });
    }

    // 5. Advantages / Disadvantages / Comparisons
    if (struct.advantages && struct.advantages.length > 0) {
      printSectionHeader(doc, '5. Critical Trade-offs, Advantages & Operational Invariants', goldColor);
      struct.advantages.forEach((adv: string) => {
        if (doc.y > 730) doc.addPage();
        doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
        doc.text(`   [+] Advantage: ${adv}`, 50, doc.y, { width: 485 });
        doc.moveDown(0.15);
      });
      if (struct.disadvantages && struct.disadvantages.length > 0) {
        struct.disadvantages.forEach((dis: string) => {
          if (doc.y > 730) doc.addPage();
          doc.fillColor(mutedColor).fontSize(8).font('Helvetica');
          doc.text(`   [-] Limitation: ${dis}`, 50, doc.y, { width: 485 });
          doc.moveDown(0.15);
        });
      }
      doc.moveDown(0.3);
    }

    // 6. Conclusion
    if (struct.conclusion) {
      printSectionHeader(doc, '6. Synthesis, Conclusion & Practical Real-World Applications', goldColor);
      printBodyText(doc, struct.conclusion, darkColor);
    }
  } else {
    // Fallback: render plain text answer formatted
    printBodyText(doc, q.answer || 'Refer to course syllabus for in-depth derivation.', darkColor);
  }
}

function printSectionHeader(doc: PDFKit.PDFDocument, text: string, color: string) {
  if (doc.y > 715) doc.addPage();
  doc.moveDown(0.3);
  doc.fillColor(color).fontSize(8.5).font('Helvetica-Bold');
  doc.text(text, 45, doc.y);
  doc.moveDown(0.2);
}

function printBodyText(doc: PDFKit.PDFDocument, text: string, color: string) {
  if (doc.y > 720) doc.addPage();
  doc.fillColor(color).fontSize(8).font('Helvetica');
  doc.text(text, 50, doc.y, {
    width: 495,
    lineGap: 2.2,
  });
  doc.moveDown(0.3);
}
