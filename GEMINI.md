# activeASSET v2 Project Guidelines & Rules

## 1. UI Standard: List & Dropdown Input Fields (กฎมาตรฐานช่องรับค่าแบบ List)

Whenever creating, editing, or refactoring input fields that present a selection list or autocomplete suggestions across the entire application, **strictly follow this uniform design standard**:

### 1.1 Structural HTML Pattern
Never use raw browser `<select>` tags for modal forms or searchable list inputs. Always use the interactive custom input pattern:

```html
<div class="input-clearable-wrap has-dropdown">
  <input 
    type="text" 
    id="<fieldId>" 
    class="form-control" 
    placeholder="<placeholder>..." 
    autocomplete="off" 
  />
  <div class="input-actions-end">
    <!-- Quick Clear Button (✕): appears automatically when text is present -->
    <button type="button" class="btn-input-clear hidden" data-clear-target="<fieldId>" title="ล้างค่า">✕</button>
    <!-- Dropdown Toggle Arrow (▾): always present to pop up the full selection list -->
    <button type="button" class="btn-input-dropdown-arrow" data-dropdown-trigger="<targetName>" title="แสดงรายการ">▾</button>
  </div>
</div>

<!-- Associated Custom Dropdown Menu -->
<div id="<fieldId>Dropdown" class="model-dropdown-menu hidden"></div>
```

### 1.2 UX & Behavioral Requirements
1. **Quick Clear (`✕`)**:
   - Hidden when input is empty.
   - Visible when text exists.
   - Clicking it clears the value, focuses the field, and triggers an `input` event to update filtering.
2. **Dropdown Toggle Arrow (`▾`)**:
   - Positioned at the far right of the input.
   - Clicking it toggles the full option list (force open even if the input is currently empty).
3. **Card-Style Dropdown Menu (`.model-dropdown-menu`)**:
   - Header bar with title, count of options, and close button (`✕`).
   - List items styled with title, subtitle/category/details, and live asset count badge (`X เครื่อง`).
   - Supports on-the-fly custom addition (`➕ ใช้...ใหม่: "..."`) when the query does not match existing options.
   - Scroll indicator arrows (▲ / ▼) for long lists.
   - Auto-positioning (`positionAddDemoDropdown` / smart flip above/below input depending on available viewport height).
4. **Clean Dismissal**:
   - Clicking anywhere outside the input or its dropdown immediately closes the dropdown menu.
5. **Keyboard Progression**:
   - Pressing `Enter` in the field confirms/advances to the next logical input field in the form.

---

## 2. Minimal & Borderless Grouping
- Do not wrap form field sections in heavy bordered cards.
- Use full-width borderless layouts with minimal horizontal hairlines and concise headers without redundant explanatory subtitles.
