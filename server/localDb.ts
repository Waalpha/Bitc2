import fs from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function getCollectionPath(collection: string) {
  const safeName = collection.replace(/[^a-zA-Z0-9_\-]/g, '_');
  return path.join(DB_DIR, `${safeName}.json`);
}

export function readCollection(collection: string): Record<string, any> {
  const filePath = getCollectionPath(collection);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading collection ${collection}:`, err);
    return {};
  }
}

export function writeCollection(collection: string, data: Record<string, any>) {
  const filePath = getCollectionPath(collection);
  try {
    const tempPath = `${filePath}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`Error writing collection ${collection}:`, err);
  }
}

function setNestedValue(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part];
  }
  
  const lastPart = parts[parts.length - 1];
  
  if (value && typeof value === 'object' && value._type === 'arrayUnion') {
    const list = Array.isArray(current[lastPart]) ? current[lastPart] : [];
    for (const elem of value.elements) {
      if (!list.includes(elem)) list.push(elem);
    }
    current[lastPart] = list;
  } else if (value && typeof value === 'object' && value._type === 'arrayRemove') {
    const list = Array.isArray(current[lastPart]) ? current[lastPart] : [];
    current[lastPart] = list.filter((elem: any) => !value.elements.includes(elem));
  } else {
    current[lastPart] = value;
  }
}

export function queryCollection(collectionName: string, constraints: any[] = []) {
  const rawData = readCollection(collectionName);
  let docs = Object.entries(rawData).map(([id, val]) => ({ id, ...val }));

  for (const c of constraints) {
    if (c.type === 'where') {
      const { field, operator, value } = c;
      docs = docs.filter(doc => {
        let docVal: any = doc;
        if (field === '__name__') {
          docVal = doc.id;
        } else if (field.includes('.')) {
          const parts = field.split('.');
          let temp: any = doc;
          for (const part of parts) {
            temp = temp?.[part];
          }
          docVal = temp;
        } else {
          docVal = (doc as any)[field];
        }

        if (operator === '==' || operator === 'is') {
          return docVal === value;
        }
        if (operator === '!=') {
          return docVal !== value;
        }
        if (operator === '>') {
          return docVal > value;
        }
        if (operator === '>=') {
          return docVal >= value;
        }
        if (operator === '<') {
          return docVal < value;
        }
        if (operator === '<=') {
          return docVal <= value;
        }
        if (operator === 'array-contains') {
          return Array.isArray(docVal) && docVal.includes(value);
        }
        if (operator === 'in') {
          return Array.isArray(value) && value.includes(docVal);
        }
        return true;
      });
    } else if (c.type === 'orderBy') {
      const { field, direction } = c;
      docs.sort((a, b) => {
        const valA = (a as any)[field];
        const valB = (b as any)[field];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (valA < valB) return direction === 'desc' ? 1 : -1;
        if (valA > valB) return direction === 'desc' ? -1 : 1;
        return 0;
      });
    } else if (c.type === 'limit') {
      docs = docs.slice(0, c.value);
    }
  }

  return docs;
}

export function updateDocumentInCol(collectionName: string, id: string, updates: any) {
  const col = readCollection(collectionName);
  const docData = col[id] || {};
  
  for (const [key, val] of Object.entries(updates)) {
    let resolvedVal = val;
    if (val && typeof val === 'object' && (val as any)._type === 'serverTimestamp') {
      resolvedVal = new Date().toISOString();
    }
    
    if (key.includes('.')) {
      setNestedValue(docData, key, resolvedVal);
    } else {
      if (resolvedVal && typeof resolvedVal === 'object' && (resolvedVal as any)._type === 'arrayUnion') {
        const list = Array.isArray(docData[key]) ? docData[key] : [];
        for (const elem of (resolvedVal as any).elements) {
          if (!list.includes(elem)) list.push(elem);
        }
        docData[key] = list;
      } else if (resolvedVal && typeof resolvedVal === 'object' && (resolvedVal as any)._type === 'arrayRemove') {
        const list = Array.isArray(docData[key]) ? docData[key] : [];
        docData[key] = list.filter((elem: any) => !(resolvedVal as any).elements.includes(elem));
      } else {
        docData[key] = resolvedVal;
      }
    }
  }
  
  col[id] = docData;
  writeCollection(collectionName, col);
}

export function setDocumentInCol(collectionName: string, id: string, data: any, options?: any) {
  const col = readCollection(collectionName);
  
  const resolvedData = { ...data };
  for (const [k, v] of Object.entries(resolvedData)) {
    if (v && typeof v === 'object' && (v as any)._type === 'serverTimestamp') {
      resolvedData[k] = new Date().toISOString();
    }
  }

  if (options?.merge && col[id]) {
    col[id] = { ...col[id], ...resolvedData };
  } else {
    col[id] = resolvedData;
  }
  
  writeCollection(collectionName, col);
}

export function addDocumentToCol(collectionName: string, data: any) {
  const col = readCollection(collectionName);
  const newId = 'doc_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
  
  const resolvedData = { ...data };
  for (const [k, v] of Object.entries(resolvedData)) {
    if (v && typeof v === 'object' && (v as any)._type === 'serverTimestamp') {
      resolvedData[k] = new Date().toISOString();
    }
  }

  col[newId] = resolvedData;
  writeCollection(collectionName, col);
  return newId;
}

export function deleteDocumentInCol(collectionName: string, id: string) {
  const col = readCollection(collectionName);
  delete col[id];
  writeCollection(collectionName, col);
}
