import { ContactFormData } from '../services/email-service-resend';


export const renderContactTemplate = (data: ContactFormData): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Contact Form Submission</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      ${data.phone ? `<p><strong>Phone:</strong> ${data.phone}</p>` : ''}
      <p><strong>Message:</strong></p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">
        ${data.message.replace(/\n/g, '<br/>')}
      </div>
    </div>
  `;
};

export const renderContactPlainText = (data: ContactFormData): string => {
  return `
NEW CONTACT FORM SUBMISSION

Name: ${data.name}
Email: ${data.email}
${data.phone ? `Phone: ${data.phone}` : ''}

Message:
${data.message}
  `.trim();
};
