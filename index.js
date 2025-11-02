const express = require('express');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper function to replace emojis with text descriptions (fallback)
function replaceEmojisWithText(text) {
  // Common emoji mappings for better readability
  const emojiMap = {
    '🚀': '[ROCKET]',
    '📌': '[PUSHPIN]',
    '📚': '[BOOKS]',
    '💪': '[FLEXED_BICEPS]',
    '🎯': '[TARGET]',
    '💚': '[GREEN_HEART]',
    '📄': '[PAGE]',
    '✅': '[CHECK]',
    '⚠️': '[WARNING]',
    '⭐': '[STAR]',
    '🔥': '[FIRE]',
    '💡': '[LIGHT_BULB]',
    '🎉': '[PARTY]',
    '👍': '[THUMBS_UP]',
    '👎': '[THUMBS_DOWN]',
  };
  
  let result = text;
  
  // First, replace known emojis with text descriptions
  for (const [emoji, replacement] of Object.entries(emojiMap)) {
    result = result.replace(new RegExp(emoji.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), replacement);
  }
  
  // For remaining emojis, replace with Unicode notation or remove
  // This regex matches most emoji ranges
  result = result.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20D0}-\u{20FF}]/gu, (match) => {
    // Remove unknown emojis or replace with space
    return ' ';
  });
  
  // Clean up multiple spaces
  result = result.replace(/\s+/g, ' ');
  
  return result;
}

// Helper function to decode HTML entities
function decodeHtmlEntities(text) {
  const entities = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&ndash;': '–',
    '&mdash;': '—',
    '&times;': '×',
    '&divide;': '÷',
    '&le;': '≤',
    '&ge;': '≥',
    '&ne;': '≠',
    '&hellip;': '...',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  return decoded;
}

// Helper function to find emoji font path
function findEmojiFontPath() {
  const possibleEmojiFontPaths = [
    // macOS
    '/System/Library/Fonts/Apple Color Emoji.ttc',
    '/Library/Fonts/Apple Color Emoji.ttc',
    // Windows (if running on Windows)
    'C:/Windows/Fonts/seguiemj.ttf',
    // Linux
    '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  ];
  
  for (const fontPath of possibleEmojiFontPaths) {
    if (fs.existsSync(fontPath)) {
      return fontPath;
    }
  }
  
  return null;
}

// Helper function to register emoji-supporting font if available
function registerEmojiFont(doc) {
  const fontPath = findEmojiFontPath();
  
  if (fontPath) {
    try {
      doc.registerFont('EmojiFont', fontPath);
      return true;
    } catch (error) {
      console.warn(`Failed to register font at ${fontPath}:`, error.message);
    }
  }
  
  return false;
}

// Helper function to clean text for PDF
function cleanText(text, preserveEmojis = false) {
  if (!text) return '';
  
  // Decode HTML entities first
  text = decodeHtmlEntities(text);
  
  // Remove HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Fix common formatting issues
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  
  // Remove excessive whitespace but preserve intentional line breaks
  text = text.replace(/[ \t]+/g, ' ');
  
  // Handle emojis: if emoji font is not available, replace them
  if (!preserveEmojis) {
    text = replaceEmojisWithText(text);
  }
  
  return text.trim();
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'leetcode-pdf-generator' });
});

// PDF generation endpoint
app.post('/generate-pdf', (req, res) => {
  try {
    const {
      problemTitle,
      problemDifficulty,
      problemTopics,
      problemLink,
      problemContent,
      analysis,
      date
    } = req.body;

    // Validate required fields
    if (!problemTitle || !analysis) {
      return res.status(400).json({ 
        error: 'Missing required fields: problemTitle and analysis are required' 
      });
    }

    // Check if emoji font path exists (before creating doc)
    const emojiFontPath = findEmojiFontPath();
    const emojiFontExists = emojiFontPath !== null;

    // Clean all text inputs (we'll preserve emojis if font gets registered successfully)
    // For now, we'll preserve emojis optimistically if font path exists
    const cleanedTitle = cleanText(problemTitle, emojiFontExists);
    const cleanedDifficulty = cleanText(problemDifficulty || '', emojiFontExists);
    const cleanedTopics = cleanText(problemTopics || '', emojiFontExists);
    const cleanedContent = cleanText(problemContent || '', emojiFontExists);
    const cleanedAnalysis = cleanText(analysis, emojiFontExists);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: {
        top: 50,
        bottom: 50,
        left: 50,
        right: 50
      },
      bufferPages: true
    });

    // Try to register emoji-supporting font
    let hasEmojiFont = false;
    if (emojiFontExists) {
      hasEmojiFont = registerEmojiFont(doc);
      if (hasEmojiFont) {
        console.log('✅ Emoji-supporting font registered');
      } else {
        console.log('⚠️  Failed to register emoji font, emojis will be replaced with text descriptions');
        // If registration failed, we need to re-clean text to replace emojis
        // Note: This is a fallback, in production you might want to handle this differently
      }
    } else {
      console.log('⚠️  No emoji font found, emojis will be replaced with text descriptions');
    }

    // Set response headers for PDF download
    const filename = `LeetCode_${date?.replace(/[^a-zA-Z0-9]/g, '_') || 'Daily'}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Helper functions for styling
    // Helper to set font with emoji support
    const setFontWithEmojiSupport = () => {
      if (hasEmojiFont) {
        try {
          doc.font('EmojiFont');
        } catch (error) {
          // Fallback to Helvetica if font registration failed at runtime
          doc.font('Helvetica');
        }
      } else {
        doc.font('Helvetica');
      }
    };

    const addTitle = (text, fontSize = 24, color = '#1a73e8') => {
      setFontWithEmojiSupport();
      doc.fontSize(fontSize)
         .fillColor(color)
         .text(text, { align: 'center' })
         .font('Helvetica') // Reset to default
         .moveDown(0.5);
    };

    const addHeading = (text, fontSize = 18, color = '#34a853') => {
      setFontWithEmojiSupport();
      doc.fontSize(fontSize)
         .fillColor(color)
         .text(text)
         .font('Helvetica') // Reset to default
         .moveDown(0.3);
    };

    const addSubHeading = (text, fontSize = 14, color = '#ea4335') => {
      setFontWithEmojiSupport();
      doc.fontSize(fontSize)
         .fillColor(color)
         .text(text)
         .font('Helvetica') // Reset to default
         .moveDown(0.2);
    };

    const addBody = (text, fontSize = 11) => {
      if (!text) return;
      setFontWithEmojiSupport();
      doc.fontSize(fontSize)
         .fillColor('#333333')
         .text(text, { align: 'justify', width: doc.page.width - 100 })
         .font('Helvetica') // Reset to default
         .moveDown(0.3);
    };

    const addCode = (text) => {
      if (!text) return;
      doc.fontSize(9)
         .fillColor('#000000')
         .font('Courier')
         .text(text, {
           indent: 20,
           width: doc.page.width - 120,
           align: 'left'
         })
         .font('Helvetica')
         .moveDown(0.5);
    };

    const addLine = () => {
      const y = doc.y;
      doc.moveTo(50, y)
         .lineTo(doc.page.width - 50, y)
         .strokeColor('#dddddd')
         .lineWidth(1)
         .stroke()
         .moveDown(0.5);
    };

    const checkPageBreak = (spaceNeeded = 100) => {
      if (doc.y > doc.page.height - spaceNeeded) {
        doc.addPage();
        return true;
      }
      return false;
    };

    // Build PDF content
    // Header
    addTitle('LeetCode Daily Challenge', 24, '#1a73e8');
    
    if (date) {
      doc.fontSize(12).fillColor('#666666').text(date, { align: 'center' }).moveDown(1);
    }

    addLine();

    // Problem Title
    addHeading(`${cleanedTitle}`, 20, '#1a73e8');

    // Metadata box
    const boxY = doc.y;
    doc.rect(50, boxY, doc.page.width - 100, 80)
       .fillAndStroke('#f8f9fa', '#dddddd');
    
    doc.y = boxY + 15;
    
    if (cleanedDifficulty) {
      doc.fontSize(11).fillColor('#333333').text(`Difficulty: ${cleanedDifficulty}`, 65).moveDown(0.2);
    }
    
    if (cleanedTopics) {
      doc.fontSize(11).fillColor('#333333').text(`Topics: ${cleanedTopics}`, 65).moveDown(0.2);
    }
    
    if (problemLink) {
      doc.fontSize(11).fillColor('#1a73e8').text(`Link: ${problemLink}`, 65, doc.y, {
        link: problemLink,
        underline: true
      });
    }
    
    doc.y = boxY + 95;
    doc.moveDown(0.5);

    // Problem Description
    if (cleanedContent) {
      checkPageBreak(150);
      addSubHeading('Problem Description');
      
      // Split content into paragraphs and handle long text
      const contentLines = cleanedContent.split('\n');
      for (const line of contentLines) {
        if (line.trim()) {
          checkPageBreak(80);
          addBody(line.substring(0, 1000)); // Limit each paragraph
        }
      }
      
      doc.addPage();
    }

    // Analysis Section
    addHeading('📚 Comprehensive Analysis & Solutions', 18, '#34a853');
    doc.moveDown(0.5);

    // Parse and render analysis
    const lines = cleanedAnalysis.split('\n');
    let inCodeBlock = false;
    let codeBuffer = '';
    let codeLanguage = '';

    for (let i = 0; i < lines.length; i++) {
      checkPageBreak(100);
      
      let line = lines[i];

      // Handle code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          // End of code block
          if (codeBuffer.trim()) {
            checkPageBreak(150);
            if (codeLanguage) {
              doc.fontSize(8).fillColor('#666666').text(`[${codeLanguage}]`, { indent: 20 });
            }
            addCode(codeBuffer.trim());
            codeBuffer = '';
            codeLanguage = '';
          }
          inCodeBlock = false;
        } else {
          // Start of code block
          inCodeBlock = true;
          codeLanguage = line.trim().substring(3).trim();
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer += line + '\n';
        continue;
      }

      line = line.trim();
      if (!line) {
        doc.moveDown(0.2);
        continue;
      }

      // Handle headings
      if (line.startsWith('## ')) {
        doc.moveDown(0.5);
        addHeading(line.substring(3));
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.3);
        addSubHeading(line.substring(4));
      } else if (line.startsWith('# ')) {
        doc.moveDown(0.5);
        addTitle(line.substring(2), 20);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet points
        doc.fontSize(11)
           .fillColor('#333333')
           .text('• ' + line.substring(2), { 
             indent: 20,
             width: doc.page.width - 120 
           });
      } else {
        // Regular text
        addBody(line);
      }
    }

    // Handle any remaining code block
    if (inCodeBlock && codeBuffer.trim()) {
      addCode(codeBuffer.trim());
    }

    // Footer
    if (doc.y < doc.page.height - 200) {
      doc.moveDown(2);
    } else {
      doc.addPage();
    }
    
    doc.y = doc.page.height - 150;
    addLine();
    doc.fontSize(16).fillColor('#1a73e8').text('Happy Coding! 💪', { align: 'center' });
    doc.fontSize(12).fillColor('#666666').text('Keep building that DSA muscle memory! 🎯', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#999999').text(`Generated on ${new Date().toLocaleString()}`, { align: 'center' });

    // Finalize PDF
    doc.end();

  } catch (error) {
    console.error('Error generating PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Failed to generate PDF', 
        message: error.message 
      });
    }
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PDF Generator Service running on port ${PORT}`);
  console.log(`📄 API Endpoint: http://localhost:${PORT}/generate-pdf`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
});