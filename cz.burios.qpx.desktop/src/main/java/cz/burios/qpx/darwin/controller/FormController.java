package cz.burios.qpx.darwin.controller;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Demo endpoint pro testovací stránku qpForm (form.jsp) - přijme hodnoty
 * z formuláře (qpForm.getValues() poslané přes AJAX POST jako běžné
 * form-urlencoded parametry) a vrátí je zpět jako JSON, aby šlo na
 * klientovi ukázat, že se data skutečně dostala až na server.
 */
@RestController
public class FormController {

	@PostMapping("/api/form/submit")
	public Map<String, Object> submit(@RequestParam Map<String, String> allParams) {
		Map<String, Object> result = new LinkedHashMap<>();
		result.put("status", "ok");
		result.put("receivedAt", LocalDateTime.now().toString());
		result.put("data", allParams);
		return result;
	}
}
