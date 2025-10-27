import { describe, it, expect } from 'vitest';
import { slugify, generateSlugFromTitle, createUniqueSlug } from '../../utils/slugify';

describe('slugify', () => {
  it('should convert Persian text to English slug', () => {
    expect(slugify('راهنمای تلگرام پریمیوم')).toBe('rahnmay-tlgram-prymvm');
  });

  it('should handle spaces and special characters', () => {
    expect(slugify('تست - نمونه / متن')).toBe('tst-nmvnh-mtn');
  });

  it('should remove multiple consecutive hyphens', () => {
    expect(slugify('تست---نمونه')).toBe('tst-nmvnh');
  });

  it('should remove leading and trailing hyphens', () => {
    expect(slugify('-تست نمونه-')).toBe('tst-nmvnh');
  });

  it('should handle empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('should handle English text', () => {
    expect(slugify('Hello World Test')).toBe('hello-world-test');
  });
});

describe('generateSlugFromTitle', () => {
  it('should generate slug from Persian title', () => {
    const title = 'راهنمای جامع استفاده از تلگرام پریمیوم';
    const slug = generateSlugFromTitle(title);
    expect(slug).toBe('rahnmay-jama-astfadh-az-tlgram-prymvm');
  });
});

describe('createUniqueSlug', () => {
  it('should return original slug if not in existing list', () => {
    const title = 'تست عنوان';
    const existingSlugs = ['other-slug', 'another-slug'];
    const slug = createUniqueSlug(title, existingSlugs);
    expect(slug).toBe('tst-anvn');
  });

  it('should append number if slug exists', () => {
    const title = 'تست عنوان';
    const existingSlugs = ['tst-anvn', 'tst-anvn-1'];
    const slug = createUniqueSlug(title, existingSlugs);
    expect(slug).toBe('tst-anvn-2');
  });

  it('should handle multiple conflicts', () => {
    const title = 'تست عنوان';
    const existingSlugs = ['tst-anvn', 'tst-anvn-1', 'tst-anvn-2', 'tst-anvn-3'];
    const slug = createUniqueSlug(title, existingSlugs);
    expect(slug).toBe('tst-anvn-4');
  });
});