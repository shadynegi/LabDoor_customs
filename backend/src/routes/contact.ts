// backend/src/routes/contact.ts
import { logger } from '../lib/logger';
import { Router, Request, Response } from 'express';
import sql from '../lib/db';
import { emailService } from '../lib/email';
import { verifyAdmin } from './admin';
import { sanitizeContactForm } from '../utils/sanitize';
import { parsePagination, paginationMeta } from '../lib/pagination';

const router = Router();

// Types
interface ContactMessage {
  id?: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status?: 'new' | 'read' | 'replied' | 'archived';
  created_at?: string;
  updated_at?: string;
}

// POST submit contact form
router.post('/', async (req: Request, res: Response) => {
  try {
    // Sanitize input to prevent XSS attacks
    const sanitized = sanitizeContactForm(req.body);
    const { name, email, subject, message } = sanitized;

    // Detailed field validation
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

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format',
        message: 'Please provide a valid email address (e.g., user@example.com)',
      });
    }

    // Length validations
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

    const result = await sql`
      INSERT INTO contact_messages (name, email, subject, message, status)
      VALUES (
        ${contactData.name}, 
        ${contactData.email}, 
        ${contactData.subject}, 
        ${contactData.message},
        'new'
      )
      RETURNING *
    `;

    // Send auto-reply (don't await - send in background)
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
  } catch (error: any) {
    logger.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit message',
      message: 'Unable to send your message. Please try again or contact us directly via email.',
    });
  }
});

// GET all contact messages (Admin only - add auth middleware in production)
router.get('/', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = parsePagination(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ success: false, error: parsed.error });
    }

    const { limit, offset } = parsed.params;
    const { status } = req.query;

    let messages;
    let countResult;

    if (status) {
      const statusStr = String(status);
      messages = await sql`
        SELECT * FROM contact_messages 
        WHERE status = ${statusStr}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as count FROM contact_messages WHERE status = ${statusStr}`;
    } else {
      messages = await sql`
        SELECT * FROM contact_messages 
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      countResult = await sql`SELECT COUNT(*) as count FROM contact_messages`;
    }

    const totalCount = Number(countResult[0].count);

    res.json({
      success: true,
      data: messages || [],
      count: totalCount,
      pagination: paginationMeta(totalCount, parsed.params),
    });
  } catch (error: any) {
    logger.error('Error fetching contact messages:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contact messages',
    });
  }
});

// GET contact statistics (Admin dashboard) — must be before /:id
router.get('/stats/summary', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const messages = await sql`
      SELECT status, created_at 
      FROM contact_messages
    `;

    const stats = {
      total: messages?.length || 0,
      new: messages?.filter((m: any) => m.status === 'new').length || 0,
      read: messages?.filter((m: any) => m.status === 'read').length || 0,
      replied: messages?.filter((m: any) => m.status === 'replied').length || 0,
      archived: messages?.filter((m: any) => m.status === 'archived').length || 0,
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    logger.error('Error fetching contact stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contact statistics',
    });
  }
});

// GET single contact message by ID (Admin only)
router.get('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const message = await sql`
      SELECT * FROM contact_messages 
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!message || message.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact message not found',
      });
    }

    const data = message[0];

    // Auto-mark as read when viewed
    if (data.status === 'new') {
      await sql`
        UPDATE contact_messages 
        SET status = 'read', updated_at = NOW()
        WHERE id = ${id}
      `;
      data.status = 'read';
    }

    res.json({
      success: true,
      data,
    });
  } catch (error: any) {
    logger.error('Error fetching contact message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch contact message',
    });
  }
});

// PATCH update contact message status (Admin only)
router.patch('/:id/status', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      });
    }

    const validStatuses = ['new', 'read', 'replied', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status value',
      });
    }

    const result = await sql`
      UPDATE contact_messages 
      SET status = ${status}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact message not found',
      });
    }

    res.json({
      success: true,
      data: result[0],
      message: 'Status updated successfully',
    });
  } catch (error: any) {
    logger.error('Error updating contact message status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update status',
    });
  }
});

// DELETE contact message (Admin only)
router.delete('/:id', verifyAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await sql`
      DELETE FROM contact_messages 
      WHERE id = ${id}
      RETURNING id
    `;

    if (!result || result.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Contact message not found',
      });
    }

    res.json({
      success: true,
      message: 'Contact message deleted successfully',
    });
  } catch (error: any) {
    logger.error('Error deleting contact message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete contact message',
    });
  }
});

export default router;

