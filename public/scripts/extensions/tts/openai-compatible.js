import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { OpenAICompatibleTtsProvider };

class OpenAICompatibleTtsProvider {
    settings;
    voices = [];
    separator = ' . ';

    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'tts-1',
        speed: 1,
        available_voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        provider_endpoint: 'http://127.0.0.1:8000/v1/audio/speech',
        customParams: [],
    };

    get settingsHtml() {
        let html = `
        <label for="openai_compatible_tts_endpoint">Provider Endpoint:</label>
        <div class="flex-container alignItemsCenter">
            <div class="flex1">
                <input id="openai_compatible_tts_endpoint" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.provider_endpoint}"/>
            </div>
            <div id="openai_compatible_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_custom_openai_tts">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        <label for="openai_compatible_model">Model:</label>
        <input id="openai_compatible_model" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.model}"/>
        <label for="openai_compatible_tts_voices">Available Voices (comma separated):</label>
        <input id="openai_compatible_tts_voices" type="text" class="text_pole" value="${this.defaultSettings.available_voices.join()}"/>
        <label for="openai_compatible_tts_speed">Speed: <span id="openai_compatible_tts_speed_output"></span></label>
        <input type="range" id="openai_compatible_tts_speed" value="1" min="0.25" max="4" step="0.05">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Custom Parameters</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <small>Add extra key-value pairs to include in the API request body.</small>
                <div id="openai_compatible_custom_params_list"></div>
                <div id="openai_compatible_custom_params_add" class="menu_button menu_button_icon">
                    <i class="fa-solid fa-plus"></i>
                    <span>Add</span>
                </div>
            </div>
        </div>`;
        return html;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.CUSTOM_OPENAI_TTS) return;
            $('#openai_compatible_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        $('#openai_compatible_tts_endpoint').val(this.settings.provider_endpoint);
        $('#openai_compatible_tts_endpoint').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_model').val(this.defaultSettings.model);
        $('#openai_compatible_model').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_voices').val(this.settings.available_voices.join());
        $('#openai_compatible_tts_voices').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_speed').val(this.settings.speed);
        $('#openai_compatible_tts_speed').on('input', () => {
            this.onSettingsChange();
        });

        $('#openai_compatible_tts_speed_output').text(this.settings.speed);

        if (!Array.isArray(this.settings.customParams)) {
            this.settings.customParams = [];
        }
        this.renderCustomParams();
        $('#openai_compatible_custom_params_add').on('click', () => {
            this.settings.customParams.push({ key: '', value: '' });
            this.renderCustomParams();
            saveTtsProviderSettings();
        });

        $('#openai_compatible_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();

        console.debug('OpenAI Compatible TTS: Settings loaded');
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.provider_endpoint = String($('#openai_compatible_tts_endpoint').val());
        this.settings.model = String($('#openai_compatible_model').val());
        this.settings.available_voices = String($('#openai_compatible_tts_voices').val()).split(',');
        this.settings.speed = Number($('#openai_compatible_tts_speed').val());
        $('#openai_compatible_tts_speed_output').text(this.settings.speed);
        saveTtsProviderSettings();
    }

    renderCustomParams() {
        const container = $('#openai_compatible_custom_params_list');
        container.empty();

        this.settings.customParams.forEach((param, index) => {
            const row = document.createElement('div');
            row.className = 'openai_compatible_custom_param_row';

            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.className = 'text_pole';
            keyInput.placeholder = 'Key (e.g. instructions)';
            keyInput.value = param.key;
            keyInput.addEventListener('input', () => {
                this.settings.customParams[index].key = keyInput.value;
                saveTtsProviderSettings();
            });

            const valueInput = document.createElement('input');
            valueInput.type = 'text';
            valueInput.className = 'text_pole';
            valueInput.placeholder = 'Value';
            valueInput.value = param.value;
            valueInput.addEventListener('input', () => {
                this.settings.customParams[index].value = valueInput.value;
                saveTtsProviderSettings();
            });

            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'menu_button menu_button_icon';
            deleteBtn.title = 'Remove parameter';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            deleteBtn.addEventListener('click', () => {
                this.settings.customParams.splice(index, 1);
                this.renderCustomParams();
                saveTtsProviderSettings();
            });

            row.append(keyInput, valueInput, deleteBtn);
            container.append(row);
        });
    }

    async checkReady() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
    }

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            oaicVoice => oaicVoice.name == voiceName,
        )[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsVoiceObjects() {
        return this.settings.available_voices.map(v => {
            return { name: v, voice_id: v, lang: 'en-US' };
        });
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, voiceId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        const customParamsObj = {};
        for (const param of this.settings.customParams) {
            const key = param.key?.trim();
            if (key) {
                customParamsObj[key] = param.value;
            }
        }

        const response = await fetch('/api/openai/custom/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                provider_endpoint: this.settings.provider_endpoint,
                model: this.settings.model,
                input: inputText,
                voice: voiceId,
                response_format: 'mp3',
                speed: this.settings.speed,
                custom_params: customParamsObj,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}
