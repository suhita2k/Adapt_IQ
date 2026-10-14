import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'data');
const files = fs.readdirSync(dataDir);

// 1. First, check materials files and ensure file_url is set
const materialFiles = files.filter(f => f.includes('_materials_') && f.endsWith('.json'));
const materialsMap = new Map(); // key: material_id, value: material

for (const mf of materialFiles) {
  const filePath = path.join(dataDir, mf);
  const materials = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let updated = false;

  for (const m of materials) {
    if (!m.file_url) {
      m.file_url = `/api/courses/${m.course_id}/materials/${m.id}/file`;
      updated = true;
    }
    materialsMap.set(m.id, m);
  }

  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(materials, null, 2), 'utf-8');
    console.log(`Updated file_urls in ${mf}`);
  }
}

// 2. Now update all sources files
const sourceFiles = files.filter(f => f.includes('_sources_') && f.endsWith('.json'));

for (const sf of sourceFiles) {
  const filePath = path.join(dataDir, sf);
  const sources = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let updatedCount = 0;

  for (const s of sources) {
    const mat = materialsMap.get(s.material_id);
    const ref = s.location_reference || '';
    const numMatch = ref.match(/\d+/);
    const parsedNum = numMatch ? parseInt(numMatch[0], 10) : undefined;

    const isPage = s.location_type === 'page' || ref.toLowerCase().includes('page');
    const isSlide = s.location_type === 'slide' || ref.toLowerCase().includes('slide');
    const isTime = s.location_type === 'timestamp' || ref.includes(':');

    if (isPage && parsedNum) {
      s.page_number = parsedNum;
      s.location_type = 'page';
    } else if (isSlide && parsedNum) {
      s.slide_number = parsedNum;
      s.location_type = 'slide';
    } else if (isTime) {
      s.timestamp = ref;
      s.location_type = 'timestamp';
    }

    if (mat) {
      s.file_name = mat.file_name;
      let targetUrl = mat.file_url || `/api/courses/${s.course_id}/materials/${mat.id}/file`;
      if (s.page_number) {
        targetUrl = `${targetUrl.split('#')[0]}#page=${s.page_number}`;
      } else if (s.slide_number) {
        targetUrl = `${targetUrl.split('#')[0]}#page=${s.slide_number}`;
      }
      s.file_url = targetUrl;
    }

    updatedCount++;
  }

  fs.writeFileSync(filePath, JSON.stringify(sources, null, 2), 'utf-8');
  console.log(`Updated ${updatedCount} sources in ${sf}`);
}

console.log('Migration of sources and materials completed successfully.');
