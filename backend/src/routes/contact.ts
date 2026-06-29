// backend/src/routes/contact.ts
import { logger } from '../lib/logger';
import { respond500 } from '../lib/safeError';
import { Router, Request, Response } from 'express';
import sql, { query as dbQuery } from '../lib/db';
import { emailService } from '../lib/email';
import { sanitizeContactForm } from '../utils/sanitize';

const router = Router();

// POST submit contact form (public; messages stored for audit — no admin inbox API)
router.post('/', async (req: Request, res: Response) => {
  try {
    const sanitized = sanitizeContactForm(req.body);
    const { name, email, subject, message } = sanitized;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
        message: 'Please provide your name',
      });
    }

    if (!email || email.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
        message: 'Please provide your email address',
      });
    }

    if (!subject || subject.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Subject is required',
        message: 'Please provide a subject for your message',
      });
    }

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required',
        message: 'Please write your message',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        message: 'Please provide a valid email address (e.g., user@example.com)',
      });
    }

    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Name too long',
        message: 'Name must be less than 100 characters',
      });
    }

    if (subject.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Subject too long',
        message: 'Subject must be less than 200 characters',
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message too long',
        message: 'Message must be less than 2000 characters',
      });
    }

    const contactData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    };

    const result = await dbQuery(() => sql`
      INSERT INTO contact_messages (name, email, subject, message, status)
      VALUES (
        ${contactData.name}, 
        ${contactData.email}, 
        ${contactData.subject}, 
        ${contactData.message},
        'new'
      )
      RETURNING id, created_at
    `, 'contact:q1');

    emailService.sendContactFormReply(
      contactData.name,
      contactData.email,
      contactData.subject
    ).catch(err => {
      logger.error('Email sending failed (non-critical):', err);
    });

    res.status(201).json({
      success: true,
      data: result[0],
      message: 'Thank you for contacting us. We will get back to you soon.',
    });
  } catch (error: unknown) {
    logger.error('Error submitting contact form:', error);
    respond500(res, error, 'Request failed');
  }
});

export default router;
