from flask import Flask, render_template, request, redirect, url_for, session, flash
import smtplib
import ssl
from email.message import EmailMessage

app = Flask(__name__)
app.secret_key = ''  # Replace with a secure, random string in production

# ---------- LOGIN ----------
@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        app_password = request.form.get('password')

        if not email or not app_password:
            flash('❗ Please enter both email and app password.', 'error')
            return redirect(url_for('login'))

        # Try SMTP login to validate credentials
        try:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=context) as smtp:
                smtp.login(email, app_password)

            session['email'] = email
            session['password'] = app_password
            flash('✅ Login successful!', 'success')
            return redirect(url_for('mode'))

        except smtplib.SMTPAuthenticationError:
            flash('❌ Invalid email or app password. Please try again.', 'error')
        except Exception as e:
            flash(f'❌ Login error: {e}', 'error')

        return redirect(url_for('login'))

    return render_template('login.html')


# ---------- MODE SELECTION ----------
@app.route('/mode', methods=['GET', 'POST'])
def mode():
    if 'email' not in session:
        flash('⚠️ Please log in first.', 'error')
        return redirect(url_for('login'))

    if request.method == 'POST':
        selected_mode = request.form.get('mode')
        if selected_mode == 'voice':
            return redirect(url_for('voice'))
        elif selected_mode == 'gesture':
            return redirect(url_for('gesture'))
        else:
            flash('⚠️ Please select a valid mode.', 'error')
            return redirect(url_for('mode'))

    return render_template('mode.html')


# ---------- VOICE MODE ----------
@app.route('/voice', methods=['GET', 'POST'])
def voice():
    if 'email' not in session:
        flash('⚠️ Please log in first.', 'error')
        return redirect(url_for('login'))

    if request.method == 'POST':
        return send_email(request)

    return render_template('voice.html')


# ---------- GESTURE MODE ----------
@app.route('/gesture', methods=['GET', 'POST'])
def gesture():
    if 'email' not in session:
        flash('⚠️ Please log in first.', 'error')
        return redirect(url_for('login'))

    if request.method == 'POST':
        return send_email(request)

    return render_template('gesture.html')


# ---------- SHARED EMAIL LOGIC ----------
def send_email(req):
    receiver = req.form.get('receiver')
    subject = req.form.get('subject')
    body = req.form.get('body')

    if not receiver:
        flash('❗ Receiver email is required.', 'error')
        return redirect(request.url)

    msg = EmailMessage()
    msg['From'] = session['email']
    msg['To'] = receiver
    msg['Subject'] = subject
    msg.set_content(body)

    try:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=context) as smtp:
            smtp.login(session['email'], session['password'])
            smtp.send_message(msg)
        flash('✅ Email sent successfully!', 'success')

    except Exception as e:
        flash(f'❌ Failed to send email: {e}', 'error')

    return redirect(request.url)


# ---------- LOGOUT ----------
@app.route('/logout')
def logout():
    session.clear()
    flash('👋 You have been logged out.', 'success')
    return redirect(url_for('login'))


# ---------- RUN ----------
if __name__ == '__main__':
    app.run(debug=True)
