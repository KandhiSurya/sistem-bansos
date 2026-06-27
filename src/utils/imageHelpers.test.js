// ==========================================
// File: utils/imageHelpers.test.js
// ==========================================
import { getDirectImageUrl } from './imageHelpers';

describe('Image Helper: getDirectImageUrl', () => {
  it('should return empty string if URL is empty or null', () => {
    expect(getDirectImageUrl('')).toBe('');
    expect(getDirectImageUrl(null)).toBe('');
    expect(getDirectImageUrl(undefined)).toBe('');
  });

  it('should not modify normal images links', () => {
    const normalLink = 'https://supabase.co/storage/v1/object/public/uploads/ktp.jpg';
    expect(getDirectImageUrl(normalLink)).toBe(normalLink);
  });

  it('should convert google drive sharing links (file/d pattern)', () => {
    const driveLink = 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I/view?usp=sharing';
    const expected = 'https://lh3.googleusercontent.com/d/1A2B3C4D5E6F7G8H9I';
    expect(getDirectImageUrl(driveLink)).toBe(expected);
  });

  it('should convert google drive open links (id query pattern)', () => {
    const driveLink = 'https://drive.google.com/open?id=9I8H7G6F5E4D3C2B1A&authuser=0';
    const expected = 'https://lh3.googleusercontent.com/d/9I8H7G6F5E4D3C2B1A';
    expect(getDirectImageUrl(driveLink)).toBe(expected);
  });

  it('should convert dropbox links with dl=0 to raw=1', () => {
    const dropboxLink = 'https://www.dropbox.com/s/abcdefgh/photo.jpg?dl=0';
    const expected = 'https://www.dropbox.com/s/abcdefgh/photo.jpg?raw=1';
    expect(getDirectImageUrl(dropboxLink)).toBe(expected);
  });

  it('should append raw=1 to dropbox links if raw=1 is not present', () => {
    const dropboxLink = 'https://www.dropbox.com/s/abcdefgh/photo.jpg';
    const expected = 'https://www.dropbox.com/s/abcdefgh/photo.jpg?raw=1';
    expect(getDirectImageUrl(dropboxLink)).toBe(expected);
  });
});
